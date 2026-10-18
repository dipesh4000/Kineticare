import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { exerciseMeta, measureAngle, movementSignal } from '../exercise/measure';
import ReferenceVideo from '../components/ReferenceVideo';
import { advanceRep, createRepState } from '../exercise/engine';
import { calibrateRest } from '../exercise/reference';
import { scoreRep, scoreRepetitions } from '../exercise/score';
import usePoseCamera from '../vision/usePoseCamera';
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
  const { state } = useLocation();
  const { patientId, assignment } = useRecords();
  const exIdx = state?.exIdx ?? 0;
  const plan = assignment(patientId);
  if (!plan?.items[exIdx]) return <div className="card">The assigned exercise is unavailable. Return to your plan.</div>;
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
  const repRef = useRef(createRepState());
  const squatSideRef = useRef(null);
  const lastCueRef = useRef(0);
  const smoothRef = useRef([]);
  const profilerRef = useRef(null);

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
    const raw = measurePose(pose);
    // Median of the last 5 samples removes single-frame keypoint jumps.
    let angle = raw;
    if (Number.isFinite(raw)) {
      smoothRef.current = [...smoothRef.current.slice(-4), raw];
      const sorted = [...smoothRef.current].sort((a, b) => a - b);
      angle = sorted[Math.floor(sorted.length / 2)];
    } else smoothRef.current = [];
    setMeasurement(Number.isFinite(angle) ? Math.round(angle) : null);

    if (calibrationRef.current) {
      if (Number.isFinite(angle)) calibrationRef.current.values.push(angle);
      const elapsed = timestamp - calibrationRef.current.startedAt;
      setCalibration(current => ({ ...current, progress: Math.min(100, Math.round(elapsed / CALIBRATION_MS * 100)) }));
      if (elapsed < CALIBRATION_MS) return;

      const result = calibrateRest(calibrationRef.current.values);
      calibrationRef.current = null;
      if (!result.ok) {
        restRef.current = null;
        setCalibration({ status: 'error', progress: 0, message: result.reason });
        return;
      }
      restRef.current = result.value;
      repRef.current = createRepState();
      setRepState(repRef.current);
      setMovementProgress(0);
      setCalibration({ status: 'ready', progress: 100, message: `Rest position: ${Math.round(result.value)}°` });
      coachRef.current = { reached: false, lastPhase: 'REST' };
      announce(`Calibrated. Start your first repetition, target ${exercise.targetReps}.`, timestamp, true);
      return;
    }

    if (!restRef.current || paused) return;
    if (!Number.isFinite(angle)) {
      repRef.current = advanceRep(repRef.current, { progress: 0, timestamp, tracked: false });
      setRepState(repRef.current);
      setMovementProgress(0);
      announce('Unable to assess. Reposition in the camera view.', timestamp);
      return;
    }

    const signal = movementSignal(exercise.ex, restRef.current, angle);
    const progress = signal / exercise.targetExcursionDeg;
    setMovementProgress(Math.max(0, progress));
    const previous = repRef.current;
    repRef.current = advanceRep(previous, { progress, timestamp });
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
      const done = repRef.current.withinTargetReps >= exercise.targetReps;
      announce(`${ORDINAL[count] ?? count}. ${repVerdict(rep)}${done ? ' All repetitions done. Press finish exercise.' : ''}`, timestamp, true);
    }
  }, [exercise.ex, exercise.targetExcursionDeg, exercise.targetReps, measurePose, paused, announce]);

  const {
    videoRef, canvasRef, status: cameraStatus, error: cameraError,
    start: startPoseCamera,
  } = usePoseCamera(onPose);
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
    if (state?.all && nextIdx !== -1) {
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

  const startCamera = async () => {
    setMode('camera');
    setTiming({ elapsed: 0, active: 0, paused: 0, unassessed: 0, readyRest: 0 });
    setMeasurement(null);
    setCalibration({ status: 'idle', progress: 0, message: '' });
    restRef.current = null;
    squatSideRef.current = null;
    smoothRef.current = [];
    repRef.current = createRepState();
    setRepState(repRef.current);
    profilerRef.current?.stop();
    profilerRef.current = startProfiler(`${exercise.ex} (camera)`);
    speak(`${exercise.ex}. Stand ${exercise.ex === 'Side Arm Raise' ? 'facing' : 'side-on to'} the camera with your whole body in view.`, true);
    await startPoseCamera();
  };

  const startCalibration = () => {
    calibrationRef.current = { startedAt: performance.now(), values: [] };
    restRef.current = null;
    repRef.current = createRepState();
    setRepState(repRef.current);
    setCalibration({ status: 'collecting', progress: 0, message: 'Hold still in your resting position.' });
    speak('Hold still in your resting position.', true);
  };

  // Start calibrating automatically once the camera sees the required joints.
  useEffect(() => {
    if (cameraStatus !== 'running' || calibration.status !== 'idle' || !trackingUsable) return undefined;
    const id = setTimeout(() => startCalibration(), 2500);
    return () => clearTimeout(id);
  }, [cameraStatus, calibration.status, trackingUsable]); // eslint-disable-line react-hooks/exhaustive-deps

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
      completion,
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
        <h2 style={{ margin: 0 }}>Workout</h2>
      </div>
      <div className="row" style={{ margin: '10px 0', flexWrap: 'wrap' }}>
        {!mode ? (
          <>
            <button className="btn" onClick={startCamera}>Start camera</button>
            <button className="btn s" onClick={() => setMode('replay')}>Use replay demo</button>
          </>
        ) : mode === 'camera' ? (
          <button className="btn s" onClick={() => setViewMode(value => value === 'camera' ? 'skeleton' : 'camera')}>{viewMode === 'camera' ? 'Canvas Live' : 'Show camera'}</button>
        ) : null}
      </div>
      {mode === 'replay' && <div className="demo">Replay demo: movement and score are simulated.</div>}
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

      <div style={{ marginTop: 12 }}>
        <div className="prog" style={{ height: 22 }} role="progressbar" aria-label="Movement progress" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(100, movementProgress * 100))}>
          <b style={{ width: `${Math.min(100, movementProgress * 100)}%`, transition: 'width .12s linear' }} />
        </div>
        <div className="row sp mut" style={{ fontSize: 12, marginTop: 2 }}><span>0%</span><span>50%</span><span>100%</span></div>
        <h2 style={{ textAlign: 'center', margin: '4px 0 0' }}>{exercise.ex}</h2>
        <p className="mut" style={{ textAlign: 'center', margin: 0 }}>{state?.all ? `${plan.items.slice(0, exIdx + 1).filter(item => !item.videoOnly).length} of ${plan.items.filter(item => !item.videoOnly).length}` : 'Single exercise'} · target {exercise.targetExcursionDeg}° × {exercise.targetReps} reps</p>
      </div>

      {reference && (
        <div style={{ marginTop: 12 }}>
          <button className="btn s sm" onClick={() => setShowDemo(value => !value)}>{showDemo ? 'Hide demo video' : 'Show demo video'}</button>
          {showDemo && <div className="vid" style={{ marginTop: 10, maxWidth: 220 }}><ReferenceVideo mediaPath={reference.mediaPath} loop autoPlay controls={false} /></div>}
        </div>
      )}
      {cameraError && <div className="demo" role="alert" style={{ marginTop: 12 }}>{cameraError}</div>}
      {mode === 'replay' && replayTrackingLost && <div className="demo" role="alert" style={{ marginTop: 12 }}>Unable to assess. Adjust your position and retry.</div>}
      {cue && mode && <div className="demo" role="status" style={{ marginTop: 12 }}>{cue}</div>}
      {(mode === 'camera' || mode === 'replay') && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row sp">
            <span>{mode === 'replay' ? 'Simulated movement' : measurement === null ? 'Required joints not visible' : `${meta.angleLabel}: ${measurement}°`}</span>
            <b>{repState.attemptedReps}/{exercise.targetReps} reps</b>
          </div>
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
              {repState.withinTargetReps >= exercise.targetReps && <p className="tag ok">Assigned repetitions reached. Finish when ready.</p>}
            </>
          )}
          {mode === 'camera' && cameraStatus === 'running' && calibration.status !== 'collecting' && (
            <button className="btn s sm" disabled={!trackingUsable} onClick={startCalibration}>
              {calibration.status === 'ready' ? 'Recalibrate' : 'Calibrate resting position'}
            </button>
          )}
        </div>
      )}

      <div className="row sp">
        <b style={{ fontSize: 24 }}>{timing.active}s</b>
        <span className="mut">{mode === 'replay' ? `of ${replayDuration}s replay` : 'assessed active time'}</span>
      </div>
      {mode === 'camera' && <p className="mut">Elapsed {timing.elapsed}s · paused {timing.paused}s · unassessed {timing.unassessed}s</p>}
      {mode === 'replay' && <div className="prog"><b style={{ width: `${Math.min(100, timing.active / replayDuration * 100)}%` }} /></div>}
      <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
        {mode && <button className="btn s" onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>}
        {mode === 'replay' && <button className="btn s" onClick={() => setReplayTrackingLost(value => !value)}>{replayTrackingLost ? 'Restore tracking' : 'Simulate tracking loss'}</button>}
        {mode && <button className="btn s" aria-pressed={speechEnabled} onClick={() => {
          const next = !speechEnabled;
          speechRef.current = next;
          setSpeechEnabled(next);
          if (next) speak('Voice guidance on.', true);
        }}>{speechEnabled ? 'Voice on · tap to mute' : 'Voice off · tap to enable'}</button>}
        {mode === 'camera' && <button className="btn" disabled={!timing.elapsed} onClick={() => finishCameraExercise()}>Finish exercise</button>}
        <button className="btn d" onClick={() => {
          if (!confirm('Stop and save this exercise as partial?')) return;
          if (mode === 'camera' && timing.elapsed) finishCameraExercise('partial');
          else if (mode === 'replay' && timing.elapsed) finish({ ex: exercise.ex, t: timing.active, s: null, completion: 'partial', c: 'Replay demo' });
          else nav('/patient/plan');
        }}>Stop</button>
      </div>
    </>
  );
}
