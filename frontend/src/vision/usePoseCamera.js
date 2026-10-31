import { useCallback, useEffect, useRef, useState } from 'react';

import { drawPose, POSE_MODES, poseSummary, createPoseFilter, filterPose } from './poseOverlay.js';
import { createPoseDetector, attachWebGLContextLossListener } from './createPoseDetector.js';
import { mapError } from '../services/errorMapping.js';

export default function usePoseCamera(onPose, filterConfig = {}) {
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
  const poseFilterRef = useRef(null);
  const activeModeRef = useRef('detailed');
  const wasRunningBeforeHideRef = useRef(false);
  const lowFpsCounterRef = useRef(0);
  const reducedResolutionRef = useRef(false);

  const [tracking, setTracking] = useState({ model: '', visible: 0, total: 0, confidence: 0, fps: 0 });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [errorDescriptor, setErrorDescriptor] = useState(null);
  const [performance, setPerformance] = useState({
    degraded: false,
    resolution: { width: 1280, height: 720 },
    lowFpsCount: 0,
  });

  useEffect(() => { onPoseRef.current = onPose; }, [onPose]);

  const stop = useCallback(() => {
    generationRef.current++;
    runningRef.current = false;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => {
      track.onended = null;
      track.stop();
    });
    detectorRef.current?.dispose();
    poseFilterRef.current?.reset();
    poseFilterRef.current = null;
    streamRef.current = null;
    detectorRef.current = null;
    setStatus('idle');
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current || typeof MediaRecorder === 'undefined') {
      throw new Error('Video recording is unavailable in this browser.');
    }
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

  const start = useCallback(async (mode = 'detailed', runFilterConfig = null) => {
    stop();
    activeModeRef.current = mode;
    const generation = generationRef.current;
    const selected = POSE_MODES[mode] ?? POSE_MODES.detailed;
    setTracking({ model: selected.label, visible: 0, total: selected.landmarks, confidence: 0, fps: 0 });
    setError('');
    setErrorDescriptor(null);
    setStatus('requesting');

    let stream;

    // 1. Camera stream acquisition with OverconstrainedError fallback
    try {
      const standardConstraints = {
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      try {
        stream = await navigator.mediaDevices.getUserMedia(standardConstraints);
      } catch (firstErr) {
        if (firstErr?.name === 'OverconstrainedError') {
          console.warn('Overconstrained camera constraints, falling back to basic user camera.');
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } });
          reducedResolutionRef.current = true;
          setPerformance(prev => ({ ...prev, degraded: true, resolution: { width: 640, height: 480 } }));
        } else {
          throw firstErr;
        }
      }

      if (generation !== generationRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      streamRef.current = stream;

      // Handle stream ending unexpectedly (device unplugged / hardware disconnection)
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          if (runningRef.current && generation === generationRef.current) {
            console.warn('Camera video track ended (hardware disconnected).');
            const mapped = mapError({ name: 'DeviceDisconnected' });
            setError(mapped.message);
            setErrorDescriptor(mapped);
            setStatus('error');
            stop();
          }
        };
      });

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      if (generation !== generationRef.current) return false;

      setStatus('loading-model');

      // 2. Load detector with WebGL -> WASM/CPU fallback & retry backoff
      const detector = await createPoseDetector(mode);
      if (generation !== generationRef.current) { detector.dispose(); return false; }
      detectorRef.current = detector;
      poseFilterRef.current = createPoseFilter(runFilterConfig || filterConfig);
      runningRef.current = true;
      setStatus('running');

      // Attach WebGL context loss listener
      const detachContextListener = attachWebGLContextLossListener(canvasRef.current, lostDesc => {
        if (runningRef.current) {
          setError(lostDesc.message);
          setErrorDescriptor(lostDesc);
          setStatus('error');
          stop();
        }
      });

      let previousFrame = null;
      const estimate = async () => {
        if (!runningRef.current || generation !== generationRef.current) return;
        try {
          const now = typeof window !== 'undefined' && window.performance ? window.performance.now() : Date.now();
          const poses = await detector.estimatePoses(video, { flipHorizontal: false }, now);
          if (generation !== generationRef.current) return;
          const timestamp = now;
          const rawPose = poses[0] ?? null;
          const pose = filterPose(poseFilterRef.current, rawPose, timestamp);
          drawPose(canvasRef.current, video, pose);
          onPoseRef.current(pose, timestamp);

          // Performance and FPS sampling
          if (timestamp - lastStatsRef.current >= 500) {
            lastStatsRef.current = timestamp;
            const currentFps = previousFrame ? Math.round(1000 / (timestamp - previousFrame)) : 0;

            // Monitor performance degradation
            if (currentFps > 0 && currentFps < 14) {
              lowFpsCounterRef.current++;
              // Sustained low FPS for >= 6 checks (3 seconds) -> reduce resolution or warn
              if (lowFpsCounterRef.current >= 6 && !reducedResolutionRef.current) {
                reducedResolutionRef.current = true;
                const track = streamRef.current?.getVideoTracks()[0];
                if (track?.applyConstraints) {
                  track.applyConstraints({ width: { ideal: 640 }, height: { ideal: 480 } }).catch(() => {});
                }
                setPerformance(prev => ({
                  ...prev,
                  degraded: true,
                  resolution: { width: 640, height: 480 },
                  lowFpsCount: prev.lowFpsCount + 1,
                }));
              }
            } else if (currentFps >= 18) {
              lowFpsCounterRef.current = Math.max(0, lowFpsCounterRef.current - 1);
            }

            setTracking({
              model: selected.label,
              ...poseSummary(pose),
              total: selected.landmarks,
              fps: currentFps,
            });
          }

          previousFrame = timestamp;
          frameRef.current = requestAnimationFrame(estimate);
        } catch (runtimeErr) {
          if (generation !== generationRef.current) return;
          runningRef.current = false;
          detachContextListener();
          stop();
          const mapped = mapError(runtimeErr);
          setStatus('error');
          setError(mapped.message);
          setErrorDescriptor(mapped);
        }
      };

      frameRef.current = requestAnimationFrame(estimate);
      return true;
    } catch (cause) {
      if (generation !== generationRef.current) return false;
      stop();
      setStatus('error');
      const mapped = mapError(cause);
      setError(mapped.message);
      setErrorDescriptor(mapped);
      return false;
    }
  }, [stop, filterConfig]);

  // Restart stream when browser tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (runningRef.current) {
          wasRunningBeforeHideRef.current = true;
        }
      } else if (document.visibilityState === 'visible') {
        if (wasRunningBeforeHideRef.current) {
          wasRunningBeforeHideRef.current = false;
          const isStreamLive = streamRef.current?.active &&
            streamRef.current.getVideoTracks().some(track => track.readyState === 'live');
          if (!isStreamLive) {
            start(activeModeRef.current);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [start]);

  useEffect(() => stop, [stop]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    errorDescriptor,
    tracking,
    performance,
    start,
    stop,
    startRecording,
    stopRecording,
  };
}
