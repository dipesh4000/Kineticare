import { useCallback, useEffect, useRef, useState } from 'react';

const CONNECTIONS = [
  ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'], ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
];

function drawPose(canvas, video, pose) {
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!pose) return;
  const points = Object.fromEntries(pose.keypoints.map(point => [point.name, point]));
  context.strokeStyle = '#b9b0ff';
  context.fillStyle = '#6d5dfc';
  context.lineWidth = Math.max(3, canvas.width / 180);
  CONNECTIONS.forEach(([from, to]) => {
    if ((points[from]?.score ?? 0) < 0.3 || (points[to]?.score ?? 0) < 0.3) return;
    context.beginPath();
    context.moveTo(points[from].x, points[from].y);
    context.lineTo(points[to].x, points[to].y);
    context.stroke();
  });
  pose.keypoints.forEach(point => {
    if ((point.score ?? 0) < 0.3) return;
    context.beginPath();
    context.arc(point.x, point.y, Math.max(3, canvas.width / 120), 0, Math.PI * 2);
    context.fill();
  });
}

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
  const lastUpdateRef = useRef(0);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => { onPoseRef.current = onPose; }, [onPose]);

  const stop = useCallback(() => {
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

  const start = useCallback(async () => {
    stop();
    setError('');
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setStatus('loading-model');

      const [tf, poseDetection] = await Promise.all([
        import('@tensorflow/tfjs-core'),
        import('@tensorflow-models/pose-detection/dist/index.js'),
        import('@tensorflow/tfjs-backend-webgl'),
      ]).then(([tf, poseDetection]) => [tf, poseDetection]);
      await tf.setBackend('webgl');
      await tf.ready();
      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING },
      );
      runningRef.current = true;
      setStatus('running');

      const estimate = async timestamp => {
        if (!runningRef.current) return;
        try {
          const poses = await detectorRef.current.estimatePoses(video);
          const pose = poses[0] ?? null;
          drawPose(canvasRef.current, video, pose);
          if (timestamp - lastUpdateRef.current >= 100) {
            lastUpdateRef.current = timestamp;
            onPoseRef.current(pose, timestamp);
          }
          frameRef.current = requestAnimationFrame(estimate);
        } catch {
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
    } catch (cause) {
      stop();
      setStatus('error');
      setError(cause?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser and retry.'
        : 'The camera or pose model could not start. Close other camera apps and retry.');
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, canvasRef, status, error, start, stop, startRecording, stopRecording };
}
