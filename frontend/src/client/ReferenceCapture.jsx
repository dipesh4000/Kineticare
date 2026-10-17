import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { exerciseMeta, isSideExercise, measureAngle, movementSignal } from '../exercise/measure';
import { calibrateRest } from '../exercise/reference';
import { removeReferenceMedia, saveReferenceMedia } from '../services/media';
import usePoseCamera from '../vision/usePoseCamera';
import { toast } from '../components/toastBus';

const REST_MS = 5000;

export default function ReferenceCapture({ exerciseName, onClose }) {
  const { user } = useAuth();
  const { workspace, saveReference } = useRecords();
  const [measurement, setMeasurement] = useState(null);
  const [stage, setStage] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Start the camera and check the supported view.');
  const [preview, setPreview] = useState(null);
  const [repCapture, setRepCapture] = useState({ count: 0, recording: false });
  const captureRef = useRef(null);
  const sideRef = useRef(null);

  const measure = useCallback(pose => {
    if (!pose) return null;
    const result = measureAngle(exerciseName, pose.keypoints, sideRef.current);
    if (captureRef.current && !sideRef.current) sideRef.current = result.side;
    return result.angle;
  }, [exerciseName]);

  const onPose = useCallback((pose, timestamp) => {
    const angle = measure(pose);
    setMeasurement(Number.isFinite(angle) ? Math.round(angle) : null);
    const capture = captureRef.current;
    if (!capture || !Number.isFinite(angle)) return;
    capture.trace.push({ t: Math.round(timestamp - capture.captureStartedAt), angle: +angle.toFixed(1) });

    if (capture.stage === 'rest-before') {
      capture.restValues.push(angle);
      const elapsed = timestamp - capture.stageStartedAt;
      setProgress(Math.min(100, Math.round(elapsed / REST_MS * 100)));
      if (elapsed >= REST_MS) {
        const rest = calibrateRest(capture.restValues, { minimumSamples: 20, maximumSpread: 12 });
        if (!rest.ok) {
          capture.stage = 'error';
          setStage('error');
          setMessage(rest.reason);
        } else {
          capture.rest = rest.value;
          capture.stage = 'reps';
          setStage('reps');
          setProgress(0);
          setMessage('Mark the start and end of each complete repetition.');
        }
      }
    } else if (capture.stage === 'reps' && capture.currentRep) {
      capture.currentRep.values.push(angle);
    } else if (capture.stage === 'rest-after') {
      capture.restAfterValues.push(angle);
      const elapsed = timestamp - capture.stageStartedAt;
      setProgress(Math.min(100, Math.round(elapsed / REST_MS * 100)));
      if (elapsed >= REST_MS) {
        capture.stage = 'ready';
        setStage('ready');
        setMessage('Capture complete. Stop and review the recording.');
      }
    }
  }, [measure]);

  const { videoRef, canvasRef, status, error, start, stop, startRecording, stopRecording } = usePoseCamera(onPose);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const beginCapture = () => {
    try {
      startRecording();
      const now = performance.now();
      captureRef.current = {
        stage: 'rest-before', stageStartedAt: now, captureStartedAt: now,
        restValues: [], restAfterValues: [], rest: null, reps: [], currentRep: null, trace: [],
      };
      sideRef.current = null;
      setStage('rest-before');
      setRepCapture({ count: 0, recording: false });
      setProgress(0);
      setMessage('Hold still in the resting position for five seconds.');
    } catch (cause) {
      setMessage(cause.message);
      setStage('error');
    }
  };

  const toggleRep = () => {
    const capture = captureRef.current;
    if (!capture.currentRep) {
      capture.currentRep = { startedAt: performance.now(), values: [] };
      setRepCapture({ count: capture.reps.length, recording: true });
      setMessage(`Recording repetition ${capture.reps.length + 1}. Return fully to rest before ending.`);
      return;
    }
    const rep = capture.currentRep;
    const peakAngle = isSideExercise(exerciseName) ? Math.min(...rep.values) : Math.max(...rep.values);
    const excursion = movementSignal(exerciseName, capture.rest, peakAngle);
    if (rep.values.length < 5 || excursion < 10) return setMessage('That segment did not contain enough visible movement. Continue and end it again.');
    capture.reps.push({ excursionDeg: +excursion.toFixed(1), durationMs: Math.round(performance.now() - rep.startedAt) });
    capture.currentRep = null;
    setRepCapture({ count: capture.reps.length, recording: false });
    setMessage(capture.reps.length === 5 ? 'Five repetitions captured. Begin the final rest period.' : `${capture.reps.length}/5 repetitions captured.`);
    setProgress(capture.reps.length / 5 * 100);
  };

  const beginFinalRest = () => {
    const capture = captureRef.current;
    capture.stage = 'rest-after';
    capture.stageStartedAt = performance.now();
    setStage('rest-after');
    setProgress(0);
    setMessage('Hold still in the resting position for five seconds.');
  };

  const stopAndReview = async () => {
    try {
      const blob = await stopRecording();
      const capture = captureRef.current;
      const excursions = capture.reps.map(rep => rep.excursionDeg).sort((a, b) => a - b);
      const durations = capture.reps.map(rep => rep.durationMs).sort((a, b) => a - b);
      const next = {
        blob,
        url: URL.createObjectURL(blob),
        targetExcursionDeg: excursions[2],
        targetDurationMs: durations[2],
        trace: capture.trace.filter((_, index) => index % 3 === 0).slice(0, 300),
        reps: capture.reps,
        durationMs: Math.round(performance.now() - capture.captureStartedAt),
      };
      setPreview(next);
      setStage('preview');
      setMessage('Review the video and derived values before approval.');
    } catch (cause) {
      setStage('error');
      setMessage(cause.message);
    }
  };

  const approve = async () => {
    const referenceId = exerciseMeta(exerciseName).key;
    const version = workspace.references.filter(item => item.referenceId === referenceId).length + 1;
    const versionId = crypto.randomUUID();
    let mediaPath;
    try {
      mediaPath = await saveReferenceMedia({ ownerUid: user.uid, referenceId, versionId, blob: preview.blob });
      await saveReference({
        referenceId, versionId, version, exerciseName,
        cameraView: exerciseMeta(exerciseName).cameraView,
        ownerUid: user.uid, status: 'approved', measurementVersion: exerciseMeta(exerciseName).measurementVersion,
        estimatorVersion: 'MoveNet SinglePose Lightning', targetExcursionDeg: preview.targetExcursionDeg,
        targetDurationMs: preview.targetDurationMs, qualitySummary: { acceptedReps: 5 }, poseTrace: preview.trace,
        mediaPath, mediaContentType: preview.blob.type, mediaDurationMs: preview.durationMs,
        createdAt: new Date().toISOString(), approvedAt: new Date().toISOString(),
      });
      toast('Reference approved');
      onClose();
    } catch {
      if (mediaPath) await removeReferenceMedia(mediaPath).catch(() => {});
      setMessage('The reference could not be saved. Retry without closing this page.');
    }
  };

  const cancel = async () => {
    if (['rest-before', 'reps', 'rest-after', 'ready', 'error'].includes(stage)) {
      try { await stopRecording(); } catch { /* recording may already be stopped */ }
    }
    stop();
    onClose();
  };

  return (
    <div className="card">
      <div className="row sp"><h2 style={{ margin: 0 }}>Capture {exerciseName}</h2><button className="btn s sm" onClick={cancel}>Close</button></div>
      <p className="mut">{exerciseMeta(exerciseName).setup}</p>
      <div className="cam">
        <video ref={videoRef} className="pose-layer" muted playsInline />
        <canvas ref={canvasRef} className="pose-layer" />
        <span className={`tag ${status === 'running' && measurement !== null ? 'ok' : 'warn'} st`}>{status === 'running' ? measurement === null ? 'Reposition' : `${measurement}°` : status.replace('-', ' ')}</span>
      </div>
      {error && <p className="demo" role="alert">{error}</p>}
      <p>{message}</p>
      {['rest-before', 'reps', 'rest-after'].includes(stage) && <div className="prog"><b style={{ width: `${progress}%` }} /></div>}
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        {status !== 'running' && stage === 'idle' && <button className="btn" onClick={start}>Start camera</button>}
        {status === 'running' && stage === 'idle' && <button className="btn" disabled={measurement === null} onClick={beginCapture}>Record reference</button>}
        {stage === 'reps' && (repCapture.recording || repCapture.count < 5) && <button className="btn" onClick={toggleRep}>{repCapture.recording ? 'End repetition' : `Start repetition ${repCapture.count + 1}`}</button>}
        {stage === 'reps' && repCapture.count === 5 && !repCapture.recording && <button className="btn s" onClick={beginFinalRest}>Begin final rest</button>}
        {stage === 'ready' && <button className="btn" onClick={stopAndReview}>Stop and review</button>}
      </div>
      {preview && <div style={{ marginTop: 12 }}>
        <video controls playsInline src={preview.url} style={{ width: '100%', borderRadius: 14 }} />
        <p>Derived median movement: <b>{preview.targetExcursionDeg}°</b> · median repetition: <b>{(preview.targetDurationMs / 1000).toFixed(1)}s</b></p>
        <div className="row"><button className="btn" onClick={approve}>Approve reference</button><button className="btn s" onClick={cancel}>Reject</button></div>
      </div>}
    </div>
  );
}
