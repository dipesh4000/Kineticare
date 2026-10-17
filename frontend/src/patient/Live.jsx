import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { armRaiseAngle, squatKneeAngle } from '../exercise/definitions';
import { advanceRep, createRepState } from '../exercise/engine';
import { calibrateRest } from '../exercise/reference';
import { scoreRepetitions } from '../exercise/score';
import usePoseCamera from '../vision/usePoseCamera';
import { saveSessionDraft } from '../session/drafts';

const CALIBRATION_MS = 2000;

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
  const replayDuration = 8;
  const [mode, setMode] = useState(null);
  const [timing, setTiming] = useState({ elapsed: 0, active: 0, paused: 0, unassessed: 0, readyRest: 0 });
  const [paused, setPaused] = useState(false);
  const [viewMode, setViewMode] = useState('camera');
  const [replayTrackingLost, setReplayTrackingLost] = useState(false);
  const [measurement, setMeasurement] = useState(null);
  const [calibration, setCalibration] = useState({ status: 'idle', progress: 0, message: '' });
  const [repState, setRepState] = useState(createRepState);
  const [movementProgress, setMovementProgress] = useState(0);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [cue, setCue] = useState('');
  const completedRef = useRef(state?.done || []);
  const calibrationRef = useRef(null);
  const restRef = useRef(null);
  const repRef = useRef(createRepState());
  const squatSideRef = useRef(null);
  const lastCueRef = useRef(0);

  const announce = useCallback((text, timestamp) => {
    if (timestamp - lastCueRef.current < 3000) return;
    lastCueRef.current = timestamp;
    setCue(text);
    if (speechEnabled && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }, [speechEnabled]);

  useEffect(() => () => {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }, []);

  const measurePose = useCallback(pose => {
    if (!pose) return null;
    if (exercise.ex === 'Squat') {
      const available = ['left', 'right']
        .map(side => ({ side, angle: squatKneeAngle(pose.keypoints, side) }))
        .filter(result => Number.isFinite(result.angle));
      if (!available.length) return null;
      const selected = available.find(result => result.side === squatSideRef.current) ?? available[0];
      if (calibrationRef.current && !squatSideRef.current) squatSideRef.current = selected.side;
      return selected.angle;
    }
    const angles = ['left', 'right']
      .map(side => armRaiseAngle(pose.keypoints, side))
      .filter(Number.isFinite);
    return angles.length === 2 ? (angles[0] + angles[1]) / 2 : null;
  }, [exercise.ex]);

  const onPose = useCallback((pose, timestamp) => {
    const angle = measurePose(pose);
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

    const signal = exercise.ex === 'Squat' ? restRef.current - angle : angle - restRef.current;
    const progress = signal / exercise.targetExcursionDeg;
    setMovementProgress(Math.max(0, progress));
    const previous = repRef.current;
    repRef.current = advanceRep(previous, { progress, timestamp });
    setRepState(repRef.current);
    if (repRef.current.attemptedReps > previous.attemptedReps) {
      announce(repRef.current.withinTargetReps > previous.withinTargetReps ? 'Repetition reached the assigned target.' : 'Repetition recorded below the assigned target.', timestamp);
    }
  }, [exercise.ex, exercise.targetExcursionDeg, measurePose, paused, announce]);

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
  }, [mode, paused, active, calibration.status, replayTrackingLost]);

  const finish = useCallback(result => {
    const completed = [...completedRef.current, result];
    saveSessionDraft(patientId, { ...state, exIdx, done: completed, sessionId: state?.sessionId });
    if (state?.all && exIdx + 1 < plan.items.length) {
      nav('/patient/live', { state: { ...state, exIdx: exIdx + 1, done: completed, all: true } });
    } else {
      nav('/patient/sum', { state: { ...state, done: completed } });
    }
  }, [state, exIdx, plan.items.length, nav, patientId]);

  useEffect(() => {
    if (mode === 'replay' && timing.active >= replayDuration) {
      finish({ ex: exercise.ex, t: replayDuration, s: +(.7 + Math.random() * .25).toFixed(2), c: 'Replay demo' });
    }
  }, [mode, timing.active, finish, exercise.ex]);

  const startCamera = async () => {
    setMode('camera');
    setTiming({ elapsed: 0, active: 0, paused: 0, unassessed: 0, readyRest: 0 });
    setMeasurement(null);
    setCalibration({ status: 'idle', progress: 0, message: '' });
    restRef.current = null;
    squatSideRef.current = null;
    repRef.current = createRepState();
    setRepState(repRef.current);
    await startPoseCamera();
  };

  const startCalibration = () => {
    calibrationRef.current = { startedAt: performance.now(), values: [] };
    restRef.current = null;
    repRef.current = createRepState();
    setRepState(repRef.current);
    setCalibration({ status: 'collecting', progress: 0, message: 'Hold still in your resting position.' });
  };

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
      attemptedReps: repState.attemptedReps,
      assessedReps: repState.assessedReps,
      withinTargetReps: repState.withinTargetReps,
      completion,
      c: score ? 'Camera measured' : 'Unable to score',
    });
  };

  const cameraLabel = calibration.status === 'collecting'
    ? 'Calibrating'
    : !trackingUsable ? 'Reposition'
      : cameraReady ? 'Tracking movement' : 'Ready to calibrate';

  return (
    <>
      <div className="row sp">
        <h2 style={{ margin: 0 }}>{exercise.ex}</h2>
        <span className="tag">{state?.all ? `${exIdx + 1} of ${plan.items.length}` : 'Single exercise'}</span>
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

      {cameraError && <div className="demo" role="alert" style={{ marginTop: 12 }}>{cameraError}</div>}
      {mode === 'replay' && replayTrackingLost && <div className="demo" role="alert" style={{ marginTop: 12 }}>Unable to assess. Adjust your position and retry.</div>}
      {cue && mode === 'camera' && <div className="demo" role="status" style={{ marginTop: 12 }}>{cue}</div>}
      {mode === 'camera' && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row sp">
            <span>{measurement === null ? 'Required joints not visible' : `${exercise.ex === 'Squat' ? 'Knee angle' : 'Average shoulder angle'}: ${measurement}°`}</span>
            <b>{repState.withinTargetReps}/{exercise.targetReps} reps</b>
          </div>
          {calibration.status === 'collecting' && <div className="prog" style={{ marginTop: 10 }}><b style={{ width: `${calibration.progress}%` }} /></div>}
          {calibration.message && <p className="mut" role={calibration.status === 'error' ? 'alert' : undefined}>{calibration.message}</p>}
          {calibration.status === 'ready' && (
            <>
              <div className="prog" aria-label={`Movement target ${Math.round(Math.min(1, movementProgress) * 100)} percent`}>
                <b style={{ width: `${Math.min(100, movementProgress * 100)}%` }} />
              </div>
              <p className="mut">Phase: {repState.phase.toLowerCase()} · attempts {repState.attemptedReps} · target range 90–110%</p>
              {repState.withinTargetReps >= exercise.targetReps && <p className="tag ok">Assigned repetitions reached. Finish when ready.</p>}
            </>
          )}
          {cameraStatus === 'running' && calibration.status !== 'collecting' && (
            <button className="btn s sm" disabled={!trackingUsable} onClick={startCalibration}>
              {calibration.status === 'ready' ? 'Recalibrate' : 'Calibrate resting position'}
            </button>
          )}
        </div>
      )}

      {!mode && (
        <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn" onClick={startCamera}>Start camera</button>
          <button className="btn s" onClick={() => setMode('replay')}>Use replay demo</button>
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
        {mode === 'camera' && <button className="btn s" onClick={() => setViewMode(value => value === 'camera' ? 'skeleton' : 'camera')}>{viewMode === 'camera' ? 'Canvas Live' : 'Show camera'}</button>}
        {mode === 'camera' && <button className="btn s" onClick={() => setSpeechEnabled(value => !value)}>{speechEnabled ? 'Mute cues' : 'Speak cues'}</button>}
        {mode === 'camera' && <button className="btn" disabled={!timing.active} onClick={finishCameraExercise}>Finish exercise</button>}
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
