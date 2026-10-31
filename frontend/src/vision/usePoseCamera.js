import { useCallback, useEffect, useRef, useState } from 'react';

import { drawPose, POSE_MODES, poseSummary, smoothPose } from './poseOverlay.js';
import { createPoseDetector } from './createPoseDetector.js';

export default function usePoseCamera(onPose) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);
  const runningRef = useRef(false);
  const recorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const onPoseRef = useRef(onPose);
  const generationRef = useRef(0);
  const lastStatsRef = useRef(0);
  const [tracking, setTracking] = useState({ model: '', visible: 0, total: 0, confidence: 0, fps: 0 });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => { onPoseRef.current = onPose; }, [onPose]);

  const stop = useCallback(() => {
    generationRef.current++;
    runningRef.current = false;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    detectorRef.current?.dispose();
    streamRef.current = null;
    detectorRef.current = null;
    setStatus('idle');
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current || typeof MediaRecorder === 'undefined') throw new Error('Video recording is unavailable in this browser.');
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(type => MediaRecorder.isTypeSupported(type));
    recordingChunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = event => { if (event.data.size) recordingChunksRef.current.push(event.data); };
    recorder.start(250);
    recorderRef.current = recorder;
  }, []);

  const stopRecording = useCallback(() => new Promise((resolve, reject) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return reject(new Error('No recording is active.'));
    recorder.onerror = event => reject(event.error);
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'video/webm' });
      recorderRef.current = null;
      recordingChunksRef.current = [];
      resolve(blob);
    };
    recorder.stop();
  }), []);

  const start = useCallback(async (mode = 'detailed') => {
    stop();
    const generation = generationRef.current;
    const selected = POSE_MODES[mode] ?? POSE_MODES.detailed;
    setTracking({ model: selected.label, visible: 0, total: selected.landmarks, confidence: 0, fps: 0 });
    setError('');
    setStatus('requesting');
    let stage = 'camera';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (generation !== generationRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      if (generation !== generationRef.current) return;
      setStatus('loading-model');
      stage = 'model';

      const detector = await createPoseDetector(mode);
      if (generation !== generationRef.current) { detector.dispose(); return; }
      detectorRef.current = detector;
      runningRef.current = true;
      setStatus('running');

      let previousFrame = null;
      let previousPose = null;
      const estimate = async () => {
        if (!runningRef.current || generation !== generationRef.current) return;
        try {
          const poses = await detector.estimatePoses(video, { flipHorizontal: false }, performance.now());
          if (generation !== generationRef.current) return;
          const timestamp = performance.now();
          const pose = smoothPose(poses[0] ?? null, previousFrame && timestamp - previousFrame < 250 ? previousPose : null);
          previousPose = pose;
          drawPose(canvasRef.current, video, pose);
          onPoseRef.current(pose, timestamp);
          if (timestamp - lastStatsRef.current >= 500) {
            lastStatsRef.current = timestamp;
            setTracking({ model: selected.label, ...poseSummary(pose), total: selected.landmarks, fps: previousFrame ? Math.round(1000 / (timestamp - previousFrame)) : 0 });
          }
          previousFrame = timestamp;
          frameRef.current = requestAnimationFrame(estimate);
        } catch {
          if (generation !== generationRef.current) return;
          runningRef.current = false;
          streamRef.current?.getTracks().forEach(track => track.stop());
          detectorRef.current?.dispose();
          streamRef.current = null;
          detectorRef.current = null;
          setStatus('error');
          setError('Pose tracking stopped unexpectedly. Restart the camera to continue.');
        }
      };
      frameRef.current = requestAnimationFrame(estimate);
      return true;
    } catch (cause) {
      if (generation !== generationRef.current) return;
      stop();
      setStatus('error');
      setError(cause?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser and retry.'
        : !navigator.mediaDevices?.getUserMedia ? 'Camera access requires HTTPS or localhost. On a phone, use your deployed HTTPS address.' : stage === 'model' ? `Tracking could not start. ${cause?.message || 'Try again or use Fast tracking.'}` : 'The camera could not start. Close other camera apps and retry.');
      return false;
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, canvasRef, status, error, tracking, start, stop, startRecording, stopRecording };
}
