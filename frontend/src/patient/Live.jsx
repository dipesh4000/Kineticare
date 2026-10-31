import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { exerciseMeta, measureAngle, calibratedProgress, repConfig } from '../exercise/measure';
import ReferenceVideo from '../components/ReferenceVideo';
import SideArmRaiseDemo from '../components/SideArmRaiseDemo';
import PreSessionChecklist from '../components/PreSessionChecklist';
import { advanceRep, createRepState } from '../exercise/engine';
import { calibrateRest } from '../exercise/reference';
import { scoreRep, scoreRepetitions } from '../exercise/score';
import usePoseCamera from '../vision/usePoseCamera';
import { getPoseFilterConfig } from '../vision/oneEuroFilter';
import { POSE_MODES, shoulderAngles } from '../vision/poseOverlay';
import { smoothAngleEMA, checkBodyAlignment } from '../vision/geometry';
import { validatePreSession, measureTorsoLength } from '../vision/sessionValidation';
import { saveSessionDraft } from '../session/drafts';
import { startProfiler } from '../session/profiler';

const CALIBRATION_MS = 2000;

const ORDINAL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const repVerdict = rep => (rep.withinTarget ? 'Good rep.' : rep.peak < 0.9 ? 'Go a little deeper.' : 'A little too far, ease off.')
  + (rep.durationMs < 1500 ? ' Slow down.' : rep.durationMs > 5500 ? ' A bit quicker.' : '');

function Skeleton({ paused }) {
  return (
    <svg viewBox="0 0 200 300" style={{ width: 160 }}>
      <g stroke="#b9b0ff" strokeWidth="5" strokeLinecap="round" fill="#b9b0ff">
        <circle cx="100" cy="55" r="18" />
        <path d="M100 75V170M100 170L75 250M100 170L125 250" />
        <g style={{ transformBox: 'fill-box', transformOrigin: 'top center', animation: paused ? 'none' : 'sw 1.6s ease-in-out infinite' }}>
          <path d="M100 95L60 150" /><circle cx="60" cy="150" r="5" />
        </g>
        <g style={{ transformBox: 'fill-box', transformOrigin: 'top center', animation: paused ? 'none' : 'sw 1.6s ease-in-out infinite', animationDirection: 'reverse' }}>
          <path d="M100 95L140 150" /><circle cx="140" cy="150" r="5" />
        </g>
      </g>
    </svg>
  );
}

export default function PatientLive() {
  const nav = useNavigate();
  const { state } = useLocation();
  const { patientId, patientPlan } = useRecords();
  const exIdx = state?.exIdx ?? 0;
  const plan = patientPlan(patientId);
  if (!plan?.items[exIdx]) return <div className="card">The assigned exercise is unavailable. Return to your plan.</div>;
  if (state?.assignmentVersion != null && state.assignmentVersion !== plan.v) return <div className="card">Your clinician updated this plan. <button className="btn" onClick={() => nav('/patient/workout')}>Open current workout</button></div>;
  return <LiveSession key={exIdx} state={state} exIdx={exIdx} plan={plan} exercise={plan.items[exIdx]} patientId={patientId} />;
}

function LiveSession({ state, exIdx, plan, exercise, patientId }) {
  const nav = useNavigate();
  const { workspace } = useRecords();
  const reference = workspace.references.find(item => item.versionId === exercise.referenceVersionId);
  const [showDemo, setShowDemo] = useState(false);
  const meta = exerciseMeta(exercise.ex);
  const replayDuration = Math.ceil(exercise.targetReps * 3);
  const [mode, setMode] = useState(null);
  const [timing, setTiming] = useState({ elapsed: 0, active: 0, paused: 0, unassessed: 0, readyRest: 0 });
  const [paused, setPaused] = useState(false);
  const [viewMode, setViewMode] = useState('camera');
  const [replayTrackingLost, setReplayTrackingLost] = useState(false);
  const [measurement, setMeasurement] = useState(null);
  const [poseMode, setPoseMode] = useState('balanced');
  const [armAngles, setArmAngles] = useState({ left: null, right: null });
  const [calibration, setCalibration] = useState({ status: 'idle', progress: 0, message: '' });
  const [repState, setRepState] = useState(createRepState);
  const [movementProgress, setMovementProgress] = useState(0);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const speechRef = useRef(true);
  const coachRef = useRef({ reached: false, lastPhase: 'REST' });
  const [cue, setCue] = useState('');
  const completedRef = useRef(state?.done || []);
  const calibrationRef = useRef(null);
  const restRef = useRef(null);
  const torsoLengthRef = useRef(null);
  const baselineRef = useRef(null);
  const repRef = useRef(createRepState());
  const [alignmentIssue, setAlignmentIssue] = useState(null);
  const [validation, setValidation] = useState(null);
  const prevAngleRef = useRef(null);
  const squatSideRef = useRef(null);
  const lastCueRef = useRef(0);
  const smoothRef = useRef([]);
  const profilerRef = useRef(null);
  const fpsRef = useRef(30);
  const lastPoseTimeRef = useRef(null);

  useEffect(() => { speechRef.current = speechEnabled; if (!speechEnabled && 'speechSynthesis' in window) speechSynthesis.cancel(); }, [speechEnabled]);

  // Spoken coaching. interrupt=true cuts off whatever is being said (used for rep counts).
  const speak = useCallback((text, interrupt = false) => {
    if (!speechRef.current || !('speechSynthesis' in window)) return;
    if (interrupt) speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find(voice => /^en-(IN|GB|US)/i.test(voice.lang)) ?? voices.find(voice => voice.lang.startsWith('en')) ?? null;
    utterance.lang = utterance.voice?.lang ?? 'en-US';
    utterance.rate = 0.95;
    speechSynthesis.speak(utterance);
  }, []);

  const announce = useCallback((text, timestamp, force = false) => {
    if (!force && timestamp - lastCueRef.current < 3000) return;
    lastCueRef.current = timestamp;
    setCue(text);
    speak(text, force);
  }, [speak]);

  useEffect(() => () => {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    profilerRef.current?.stop();
  }, []);

  const measurePose = useCallback(pose => {
    if (!pose) return null;
    const result = measureAngle(exercise.ex, pose.keypoints, squatSideRef.current);
    if (calibrationRef.current && !squatSideRef.current) squatSideRef.current = result.side;
    return result.angle;
  }, [exercise.ex]);

  const onPose = useCallback((pose, timestamp) => {
    profilerRef.current?.tick();
    if (lastPoseTimeRef.current && timestamp > lastPoseTimeRef.current) {
      const deltaMs = timestamp - lastPoseTimeRef.current;
      if (deltaMs > 0) fpsRef.current = Math.round(1000 / deltaMs);
    }
    lastPoseTimeRef.current = timestamp;

    const alignCheck = checkBodyAlignment(exercise.ex, pose?.keypoints);
    setAlignmentIssue(alignCheck.isAligned ? null : alignCheck.message);
    const preCheck = validatePreSession({
      exerciseName: exercise.ex,
      keypoints: pose?.keypoints,
      fps: fpsRef.current,
    });
    setValidation(preCheck);

    const raw = measurePose(pose);
    if (exercise.ex === 'Side Arm Raise') setArmAngles(shoulderAngles(pose?.keypoints));
    // Combined 5-sample median window + Exponential Moving Average (EMA) smoother
    let angle = raw;
    if (Number.isFinite(raw)) {
      smoothRef.current = [...smoothRef.current.slice(-4), raw];
      const sorted = [...smoothRef.current].sort((a, b) => a - b);
      const medianAngle = sorted[Math.floor(sorted.length / 2)];
      angle = smoothAngleEMA(medianAngle, prevAngleRef.current, 0.35);
      prevAngleRef.current = angle;
    } else {
      smoothRef.current = [];
      prevAngleRef.current = null;
    }
    setMeasurement(Number.isFinite(angle) ? Math.round(angle) : null);

    if (calibrationRef.current) {
      const torsoLength = measureTorsoLength(pose?.keypoints);
      if (Number.isFinite(raw) && alignCheck.isAligned) {
        calibrationRef.current.samples.push({ angle: raw, torsoLength });
      }
      const elapsed = timestamp - calibrationRef.current.startedAt;
      setCalibration(current => ({ ...current, progress: Math.min(100, Math.round(elapsed / CALIBRATION_MS * 100)) }));
      if (elapsed < CALIBRATION_MS) return;

      const result = calibrateRest(calibrationRef.current.samples);
      calibrationRef.current = null;
      if (!result.ok) {
        restRef.current = null;
        torsoLengthRef.current = null;
        baselineRef.current = null;
        setCalibration({ status: 'error', progress: 0, message: result.reason });
        return;
      }
      if ((exercise.ex === 'Side Arm Raise' && result.value > 35) || (exercise.ex !== 'Side Arm Raise' && result.value < 145)) {
        setCalibration({ status: 'error', progress: 0, message: exercise.ex === 'Side Arm Raise' ? 'Lower both arms to your sides, then retry setup.' : 'Stand upright and still, then retry setup.' });
        return;
      }
      restRef.current = result.value;
      torsoLengthRef.current = result.torsoLength;
      baselineRef.current = {
        restAngle: result.value,
        torsoLength: result.torsoLength,
        variance: result.variance,
        stdDev: result.stdDev,
      };
      repRef.current = advanceRep(repRef.current, { progress: 0, timestamp, tracked: false });
      setRepState(repRef.current);
      setMovementProgress(0);
      setCalibration({ status: 'ready', progress: 100, message: `Setup complete. Rest position: ${Math.round(result.value)}°. Return here after every repetition.` });
      coachRef.current = { reached: false, lastPhase: 'REST' };
      announce(`Calibrated. Start your first repetition, target ${exercise.targetReps}.`, timestamp, true);
      return;
    }

    if (!Number.isFinite(restRef.current) || paused) return;
    if (!Number.isFinite(angle)) {
      repRef.current = advanceRep(repRef.current, { progress: 0, timestamp, tracked: false });
      setRepState(repRef.current);
      setMovementProgress(0);
      announce('Unable to assess. Reposition in the camera view.', timestamp);
      return;
    }

    const progress = calibratedProgress(exercise.ex, restRef.current, angle, exercise.targetExcursionDeg);
    if (progress === null) return;
    setMovementProgress(Math.max(0, progress));
    const previous = repRef.current;
    repRef.current = advanceRep(previous, { angle, progress, timestamp }, repConfig(exercise.ex, restRef.current, exercise.targetExcursionDeg));
    setRepState(repRef.current);
    if (repRef.current.rejectedReps > (previous.rejectedReps ?? 0)) {
      announce('Movement not counted. Check your camera position and move smoothly.', timestamp, true);
    }
    // Mid-rep coaching: tell the user when they have reached the target depth.
    const coach = coachRef.current;
    if (repRef.current.phase === 'OUTBOUND' && !coach.reached && progress >= 0.9) {
      coach.reached = true;
      announce('Good, now return.', timestamp, true);
    }
    if (repRef.current.phase === 'REST') coach.reached = false;
    if (repRef.current.attemptedReps > previous.attemptedReps) {
      const rep = repRef.current.reps.at(-1);
      const count = repRef.current.attemptedReps;
      const done = repRef.current.attemptedReps >= exercise.targetReps;
      announce(`${ORDINAL[count] ?? count}. ${repVerdict(rep)}${done ? ' All repetitions done. Press finish exercise.' : ''}`, timestamp, true);
    }
  }, [exercise.ex, exercise.targetExcursionDeg, exercise.targetReps, measurePose, paused, announce]);

  const filterConfig = useMemo(() => getPoseFilterConfig(exercise.ex), [exercise.ex]);
  const {
    videoRef, canvasRef, status: cameraStatus, error: cameraError, tracking,
    start: startPoseCamera,
  } = usePoseCamera(onPose, filterConfig);
  const cameraReady = cameraStatus === 'running' && calibration.status === 'ready';
  const trackingUsable = measurement !== null;
  const active = mode === 'replay' ? !replayTrackingLost : cameraReady && trackingUsable;

  useEffect(() => {
    const id = setInterval(() => {
      if (!mode) return;
      setTiming(previous => {
        if (mode === 'replay' && previous.active >= replayDuration) return previous;
        const category = paused ? 'paused' : active ? 'active' : calibration.status === 'ready' || replayTrackingLost ? 'unassessed' : 'readyRest';
        return { ...previous, elapsed: previous.elapsed + 1, [category]: previous[category] + 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [mode, paused, active, calibration.status, replayTrackingLost, replayDuration]);

  const finish = useCallback(result => {
    speak('Exercise complete.', true);
    const completed = [...completedRef.current, result];
    saveSessionDraft(patientId, { ...state, exIdx, done: completed, sessionId: state?.sessionId });
    const nextIdx = plan.items.findIndex((item, index) => index > exIdx && !item.videoOnly);
    if (state?.all && nextIdx !== -1 && result.completion !== 'partial') {
      nav('/patient/live', { state: { ...state, exIdx: nextIdx, done: completed, all: true } });
    } else {
      nav('/patient/sum', { state: { ...state, done: completed } });
    }
  }, [state, exIdx, plan.items, nav, patientId, speak]);

  // Replay: a synthetic movement signal goes through the same rep counter and scoring as the camera.
  useEffect(() => {
    if (mode !== 'replay' || paused || replayTrackingLost) return undefined;
    const peaks = [1, 0.98, 1.04, 0.95, 1.02, 1.0, 0.97];
    const startedAt = performance.now() - timing.active * 1000;
    const id = setInterval(() => {
      const now = performance.now();
      const cycle = (now - startedAt) / 3000;
      const phase = cycle % 1;
      const peak = peaks[Math.floor(cycle) % peaks.length];
      const progress = phase < 0.12 || phase > 0.92 ? 0 : peak * Math.sin(Math.PI * (phase - 0.12) / 0.8);
      setMovementProgress(Math.max(0, progress));
      const before = repRef.current.attemptedReps;
      repRef.current = advanceRep(repRef.current, { progress, timestamp: now });
      setRepState(repRef.current);
      if (repRef.current.attemptedReps > before) {
        const count = repRef.current.attemptedReps;
        setCue(`Rep ${count}: ${repVerdict(repRef.current.reps.at(-1))}`);
        speak(`${ORDINAL[count] ?? count}. ${repVerdict(repRef.current.reps.at(-1))}`, true);
      }
    }, 100);
    return () => clearInterval(id);
  }, [mode, paused, replayTrackingLost, speak]); // eslint-disable-line react-hooks/exhaustive-deps

  const replayDone = mode === 'replay' && timing.active >= replayDuration;
  useEffect(() => {
    if (!replayDone) return;
    const reps = repRef.current.reps;
    const score = scoreRepetitions(reps);
    finish({
      ex: exercise.ex, t: replayDuration, elapsedMs: replayDuration * 1000, activeMs: replayDuration * 1000,
      trackingCoverage: 1,
      baseline: baselineRef.current || {
        restAngle: restRef.current,
        torsoLength: torsoLengthRef.current,
      },
      s: score ? score.score / 100 : null, movementScore: score?.score ?? null,
      scoreComponents: score?.components ?? null, formulaVersion: score?.formulaVersion ?? null,
      targetExcursionDeg: exercise.targetExcursionDeg,
      targetReps: exercise.targetReps,
      reps: reps.map(rep => ({
        peak: +rep.peak.toFixed(2),
        durationMs: Math.round(rep.durationMs),
        outboundMs: rep.outboundMs || Math.round(rep.durationMs * 0.44),
        returnMs: rep.returnMs || Math.round(rep.durationMs * 0.56),
        eccentricRatio: rep.eccentricRatio || 1.27,
        peakDeg: Math.round(rep.peak * exercise.targetExcursionDeg),
        withinTarget: rep.withinTarget,
        score: scoreRep(rep).score,
      })),
      attemptedReps: repRef.current.attemptedReps, assessedReps: repRef.current.assessedReps, withinTargetReps: repRef.current.withinTargetReps,
      completion: 'completed', c: 'Replay demo (simulated)',
    });
  }, [replayDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCamera = async (requestedMode = poseMode) => {
    const selectedMode = typeof requestedMode === 'string' ? requestedMode : poseMode;
    setPoseMode(selectedMode);
    setPaused(false);
    calibrationRef.current = null;
    setMode('camera');
    if (mode !== 'camera') setTiming({ elapsed: 0, active: 0, paused: 0, unassessed: 0, readyRest: 0 });
    setMeasurement(null);
    setCalibration({ status: 'idle', progress: 0, message: '' });
    restRef.current = null;
    squatSideRef.current = null;
    smoothRef.current = [];
    prevAngleRef.current = null;
    repRef.current = mode === 'camera' ? advanceRep(repRef.current, { progress: 0, timestamp: performance.now(), tracked: false }) : createRepState();
    setRepState(repRef.current);
    profilerRef.current?.stop();
    profilerRef.current = startProfiler(`${exercise.ex} (camera)`);
    speak(`${exercise.ex}. Stand ${exercise.ex === 'Side Arm Raise' ? 'facing' : 'side-on to'} the camera with your whole body in view.`, true);
    const started = await startPoseCamera(selectedMode);
    if (started) videoRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const startCalibration = () => {
    if (validation && !validation.ok) {
      announce(validation.message, performance.now(), true);
      return;
    }
    setPaused(false);
    squatSideRef.current = null;
    smoothRef.current = [];
    prevAngleRef.current = null;
    calibrationRef.current = { startedAt: performance.now(), samples: [] };
    restRef.current = null;
    repRef.current = advanceRep(repRef.current, { progress: 0, timestamp: performance.now(), tracked: false });
    setRepState(repRef.current);
    setCalibration({ status: 'collecting', progress: 0, message: exercise.ex === 'Side Arm Raise' ? 'Keep both arms down and hold still for 2 seconds.' : 'Stand upright and hold still for 2 seconds.' });
    speak('Hold still in your resting position.', true);
  };

  // Start calibrating automatically once the camera sees the required joints.
  useEffect(() => {
    if (paused || cameraStatus !== 'running' || calibration.status !== 'idle' || !trackingUsable || !validation?.ok) return undefined;
    const id = setTimeout(() => startCalibration(), 700);
    return () => clearTimeout(id);
  }, [cameraStatus, calibration.status, trackingUsable, paused, validation?.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePause = () => {
    if (!paused) {
      repRef.current = advanceRep(repRef.current, { progress: 0, timestamp: performance.now(), tracked: false });
      setRepState(repRef.current);
      setMovementProgress(0);
    }
    setPaused(value => !value);
  };

  const finishCameraExercise = (completion = 'completed') => {
    const score = scoreRepetitions(repState.reps);
    finish({
      ex: exercise.ex,
      t: timing.active,
      elapsedMs: timing.elapsed * 1000,
      activeMs: timing.active * 1000,
      pausedMs: timing.paused * 1000,
      unassessedMs: timing.unassessed * 1000,
      readyRestMs: timing.readyRest * 1000,
      trackingCoverage: timing.elapsed - timing.paused > 0 ? +(timing.active / (timing.elapsed - timing.paused)).toFixed(3) : null,
      baseline: baselineRef.current || {
        restAngle: restRef.current,
        torsoLength: torsoLengthRef.current,
      },
      s: score ? score.score / 100 : null,
      movementScore: score?.score ?? null,
      scoreComponents: score?.components ?? null,
      formulaVersion: score?.formulaVersion ?? null,
      reps: repState.reps.map(rep => ({
        peak: +rep.peak.toFixed(2),
        durationMs: Math.round(rep.durationMs),
        outboundMs: rep.outboundMs || Math.round(rep.durationMs * 0.45),
        returnMs: rep.returnMs || Math.round(rep.durationMs * 0.55),
        eccentricRatio: rep.eccentricRatio || 1.2,
        peakDeg: Math.round(rep.peak * exercise.targetExcursionDeg),
        withinTarget: rep.withinTarget,
        score: scoreRep(rep).score,
      })),
      targetExcursionDeg: exercise.targetExcursionDeg,
      targetReps: exercise.targetReps,
      attemptedReps: repState.attemptedReps,
      assessedReps: repState.assessedReps,
      withinTargetReps: repState.withinTargetReps,
      completion: completion === 'completed' && repState.assessedReps >= exercise.targetReps ? 'completed' : 'partial',
      mode: 'live',
      c: score ? 'Camera measured' : 'Unable to score',
    });
  };

  const liveScore = scoreRepetitions(repState.reps);
  const lastRep = repState.reps.at(-1);

  const cameraLabel = calibration.status === 'collecting'
    ? 'Calibrating'
    : !trackingUsable ? 'Reposition'
      : cameraReady ? 'Tracking movement' : 'Ready to calibrate';

  return (
    <>
      <div className="row sp">
        <h2 style={{ margin: 0 }}>{exercise.ex}</h2><span className="tag">{exercise.targetReps} reps · {exercise.targetExcursionDeg}° target</span>
      </div>
      <p className="mut">{!mode ? '1. Preview the movement. 2. Start exercise below. 3. Hold still for camera setup.' : calibration.status === 'ready' ? 'Move slowly, then return fully to your resting position to count each rep.' : mode === 'replay' ? 'Practice preview — these repetitions are simulated.' : 'Wait for “Tracking movement” before starting your reps.'}</p>
      {exercise.ex === 'Side Arm Raise' && !mode && <SideArmRaiseDemo target={exercise.targetExcursionDeg} />}
      {reference && !mode && <div className="card session-demo"><h3>Movement demonstration</h3><ReferenceVideo mediaPath={reference.mediaPath} /><p className="mut">{meta.setup} Start below when you are ready.</p></div>}
      {(!mode || cameraStatus === 'error') && <label className="tracking-select">Tracking detail<select value={poseMode} onChange={event => setPoseMode(event.target.value)}>{Object.entries(POSE_MODES).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}</select><span className="mut">Choose Balanced or Fast if your phone struggles. Retrying keeps completed repetitions; camera setup runs again.</span></label>}
      {mode === 'camera' && cameraStatus === 'loading-model' && <p className="session-status" role="status">Loading {POSE_MODES[poseMode].label.toLowerCase()} tracking. The first start downloads the model and needs an internet connection.</p>}
      {mode === 'replay' && <div className="demo">Replay demo: movement and score are simulated.</div>}
      {mode === 'camera' && cameraStatus === 'running' && <div className="tracking-panel" aria-label="Tracking quality"><div><b>{tracking.visible}/{tracking.total || 33}</b><span>Landmarks visible</span></div><div><b>{tracking.confidence}%</b><span>Detection confidence</span></div><div><b>{tracking.fps || '—'}</b><span>Frames / sec</span></div><p><span className="tracking-dot left" />Your left side <span className="tracking-dot right" />Your right side · {tracking.model}</p></div>}
      {mode === 'camera' && cameraStatus === 'running' && calibration.status !== 'ready' && (
        <PreSessionChecklist
          validation={validation}
          calibrationStatus={calibration.status}
          calibrationProgress={calibration.progress}
          calibrationMessage={calibration.message}
          onRetryCalibration={startCalibration}
          canCalibrate={trackingUsable && validation?.ok}
        />
      )}
      <div className="live-monitor" hidden={!mode}>
      <div className={`cam${paused || !active ? ' paused' : ''}`} aria-label={mode === 'camera' ? 'Live camera with pose overlay' : 'Exercise preview'}>
        <video ref={videoRef} className="pose-layer" style={{ visibility: viewMode === 'skeleton' ? 'hidden' : 'visible' }} muted playsInline />
        <canvas ref={canvasRef} className="pose-layer" />
        {mode !== 'camera' && <Skeleton paused={paused || replayTrackingLost || !mode} />}
        <span className={`tag ${active ? 'ok' : 'warn'} st`}>
          {mode === 'camera'
            ? cameraStatus === 'running' ? cameraLabel : cameraStatus.replace('-', ' ')
            : mode === 'replay' ? replayTrackingLost ? 'Tracking unavailable' : 'Replay tracking' : 'Camera not started'}
        </span>
      </div>

      </div>
      {alignmentIssue && mode === 'camera' && (
        <div className="demo" role="alert" style={{ background: 'var(--warnb)', color: 'var(--warn)', borderColor: 'rgba(180,83,9,0.3)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span>⚠️ <b>Orientation Check:</b> {alignmentIssue}</span>
        </div>
      )}

      <div hidden={!mode} style={{ marginTop: 12 }}>
        <div className="prog" style={{ height: 22 }} role="progressbar" aria-label="Movement progress" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(100, movementProgress * 100))}>
          <b style={{ width: `${Math.min(100, movementProgress * 100)}%`, transition: 'width .12s linear' }} />
        </div>
        <div className="row sp mut" style={{ fontSize: 12, marginTop: 2 }}><span>0%</span><span>50%</span><span>100%</span></div>
        <h2 style={{ textAlign: 'center', margin: '4px 0 0' }}>{exercise.ex}</h2>
        <p className="mut" style={{ textAlign: 'center', margin: 0 }}>{state?.all ? `${plan.items.slice(0, exIdx + 1).filter(item => !item.videoOnly).length} of ${plan.items.filter(item => !item.videoOnly).length}` : 'Single exercise'} · target {exercise.targetExcursionDeg}° × {exercise.targetReps} reps</p>
      </div>

      {reference && mode && (
        <div style={{ marginTop: 12 }}>
          <button className="btn s sm" onClick={() => setShowDemo(value => !value)}>{showDemo ? 'Hide demo video' : 'Show demo video'}</button>
          {showDemo && <div className="vid" style={{ marginTop: 10, maxWidth: 220 }}><ReferenceVideo mediaPath={reference.mediaPath} loop autoPlay controls={false} /></div>}
        </div>
      )}
      {exercise.ex === 'Side Arm Raise' && mode && <details className="card"><summary>Show arm raise animation</summary><SideArmRaiseDemo target={exercise.targetExcursionDeg} /></details>}
      {cameraError && <div className="demo" role="alert" style={{ marginTop: 12 }}>{cameraError}</div>}
      {mode === 'replay' && replayTrackingLost && <div className="demo" role="alert" style={{ marginTop: 12 }}>Unable to assess. Adjust your position and retry.</div>}
      {cue && mode && <div className="demo" role="status" style={{ marginTop: 12 }}>{cue}</div>}
      {(cameraReady || mode === 'replay') && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row sp">
            <span>{mode === 'replay' ? 'Simulated movement' : measurement === null ? 'Required joints not visible' : `${meta.angleLabel}: ${measurement}°`}</span>
            <b>{repState.attemptedReps}/{exercise.targetReps} reps</b>
          </div>
          {mode === 'camera' && exercise.ex === 'Side Arm Raise' && <div className="arm-angle-readout"><span>Left arm <b>{Number.isFinite(armAngles.left) ? `${Math.round(armAngles.left)}°` : 'Not visible'}</b></span><span>Right arm <b>{Number.isFinite(armAngles.right) ? `${Math.round(armAngles.right)}°` : 'Not visible'}</b></span><p className="mut">Both arms must lift and return. Keep your hips and both elbows in frame.</p></div>}
          {mode === 'camera' && calibration.status === 'collecting' && <div className="prog" style={{ marginTop: 10 }}><b style={{ width: `${calibration.progress}%` }} /></div>}
          {mode === 'camera' && calibration.message && <p className="mut" role={calibration.status === 'error' ? 'alert' : undefined}>{calibration.message}</p>}
          {(calibration.status === 'ready' || mode === 'replay') && (
            <>
              <div className="st4" style={{ margin: '10px 0' }}>
                <div><b>{repState.attemptedReps}</b>Reps counted</div>
                <div><b>{repState.withinTargetReps}</b>On target</div>
                <div><b>{liveScore ? liveScore.score : '—'}</b>Live score</div>
                <div><b>{lastRep ? `${(lastRep.durationMs / 1000).toFixed(1)}s` : '—'}</b>Last rep time</div>
              </div>
              <p className="mut">Phase: {repState.phase.toLowerCase()} · target range 90–110% of {exercise.targetExcursionDeg}°{repState.rejectedReps ? ` · ${repState.rejectedReps} movement(s) ignored (tracking glitch or out of range)` : ''}</p>
              {repState.reps.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="Repetition log">
                  {repState.reps.map((rep, index) => (
                    <span key={index} className={`tag ${rep.withinTarget ? 'ok' : 'warn'}`}>
                      #{index + 1} · {Math.round(rep.peak * 100)}% · {(rep.durationMs / 1000).toFixed(1)}s · {scoreRep(rep).score}
                    </span>
                  ))}
                </div>
              )}
              {repState.attemptedReps >= exercise.targetReps && <p className="tag ok" role="status">Assigned repetitions reached. Finish when ready.</p>}
            </>
          )}
          {mode === 'camera' && cameraStatus === 'running' && calibration.status !== 'collecting' && (
            <button className="btn s sm" disabled={!trackingUsable} onClick={startCalibration}>
              {calibration.status === 'ready' ? 'Recalibrate' : 'Calibrate resting position'}
            </button>
          )}
        </div>
      )}

      {mode && <div className="row sp">
        <b style={{ fontSize: 24 }}>{timing.active}s</b>
        <span className="mut">{mode === 'replay' ? `of ${replayDuration}s replay` : 'assessed active time'}</span>
      </div>}
      {mode === 'camera' && <p className="mut">Elapsed {timing.elapsed}s · paused {timing.paused}s · unassessed {timing.unassessed}s</p>}
      {mode === 'replay' && <div className="prog"><b style={{ width: `${Math.min(100, timing.active / replayDuration * 100)}%` }} /></div>}
      <div className={`row session-actions${!mode ? ' session-start-actions' : ''}`}>
        {!mode && <><p className="mut start-help">Ready to begin? Your camera opens next, followed by a short resting-position setup.</p><button className="btn session-primary" onClick={startCamera}>Start exercise</button><button className="btn s" onClick={() => setMode('replay')}>Try a simulated demo</button></>}
        {mode === 'camera' && cameraStatus === 'error' && <><button className="btn session-primary" onClick={startCamera}>Retry camera setup</button>{poseMode !== 'fast' && <button className="btn s" onClick={() => startCamera('fast')}>Try Fast tracking</button>}</>}
        {mode === 'camera' && ['requesting', 'loading-model'].includes(cameraStatus) && <button className="btn session-primary" disabled>{cameraStatus === 'requesting' ? 'Opening camera…' : 'Loading tracking…'}</button>}
        {mode === 'camera' && cameraStatus === 'running' && <button className="btn s" onClick={() => setViewMode(value => value === 'camera' ? 'skeleton' : 'camera')}>{viewMode === 'camera' ? 'Skeleton view' : 'Show camera'}</button>}
        {(mode === 'replay' || cameraReady) && <button className="btn s" onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>}
        {mode === 'replay' && <button className="btn s" onClick={() => setReplayTrackingLost(value => !value)}>{replayTrackingLost ? 'Restore tracking' : 'Simulate tracking loss'}</button>}
        {(mode === 'replay' || cameraStatus === 'running') && <button className="btn s" aria-pressed={speechEnabled} onClick={() => {
          const next = !speechEnabled;
          speechRef.current = next;
          setSpeechEnabled(next);
          if (next) speak('Voice guidance on.', true);
        }}>{speechEnabled ? 'Voice on · tap to mute' : 'Voice off · tap to enable'}</button>}
        {mode === 'camera' && cameraStatus === 'running' && <button className="btn" disabled={!cameraReady || !timing.active} onClick={() => finishCameraExercise()}>Finish exercise</button>}
        <button className={mode ? 'btn d' : 'btn s'} onClick={() => {
          if (timing.active > 0 && !confirm('Stop and save this exercise as partial?')) return;
          if (mode === 'camera' && timing.active > 0) finishCameraExercise('partial');
          else if (mode === 'replay' && timing.elapsed) finish({ ex: exercise.ex, t: timing.active, s: null, completion: 'partial', c: 'Replay demo' });
          else nav('/patient/plan');
        }}>{mode ? 'Stop' : 'Back to plan'}</button>
      </div>
    </>
  );
}
