// Development-only inference check against the bundled demonstration, no camera.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPoseDetector } from '../src/vision/createPoseDetector';
import { drawPose, poseSummary, smoothPose, POSE_MODES } from '../src/vision/poseOverlay';
import '../src/index.css';

export default function PoseModelPreview() {
  const video = useRef(null), canvas = useRef(null), detector = useRef(null), frame = useRef(null), active = useRef(false);
  const [mode, setMode] = useState('detailed');
  const [status, setStatus] = useState('Ready to verify');
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  function stop() { active.current = false; cancelAnimationFrame(frame.current); detector.current?.dispose(); detector.current = null; video.current?.pause(); }
  useEffect(() => stop, []);
  async function start() {
    stop(); setBusy(true); setStats(null); setStatus('Loading model…');
    try {
      detector.current = await createPoseDetector(mode);
      await video.current.play(); active.current = true;
      let previousPose = null;
      const estimate = async () => {
        if (!active.current) return;
        try {
          const poses = await detector.current.estimatePoses(video.current, { flipHorizontal: false }, performance.now());
          if (!active.current) return;
          const pose = smoothPose(poses[0] ?? null, previousPose);
          previousPose = pose;
          drawPose(canvas.current, video.current, pose);
          setStats({ ...poseSummary(pose), names: pose?.keypoints.map(point => `${point.name}: score=${point.score}, x=${Math.round(point.x)}, y=${Math.round(point.y)}`) ?? [] });
          setStatus(`${pose?.keypoints.length ?? 0} landmarks returned`);
          frame.current = requestAnimationFrame(estimate);
        } catch (error) { setStatus(error.message); stop(); }
      };
      frame.current = requestAnimationFrame(estimate);
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }
  return <main className="center" style={{ maxWidth: 850 }}><h1>Pose model verification</h1><p>Runs the production detector and overlay on the bundled squat video. No camera access or patient records.</p><label>Model<select value={mode} disabled={busy} onChange={event => setMode(event.target.value)}>{Object.entries(POSE_MODES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label><div className="row"><button className="btn" disabled={busy} onClick={start}>Verify model</button><button className="btn s" disabled={busy} onClick={() => { stop(); setStatus('Stopped'); }}>Stop verification</button></div><p role="status">{status}</p><div className="cam" style={{ aspectRatio: '16/9', height: 'auto' }}><video ref={video} className="pose-layer" src="/demo/squat.mp4" muted playsInline loop /><canvas ref={canvas} className="pose-layer" /></div>{stats && <><p>{stats.visible} visible · {stats.confidence}% detection confidence</p><details><summary>Returned landmark names</summary><p>{stats.names.join(', ')}</p></details></>}</main>;
}
createRoot(document.getElementById('root')).render(<PoseModelPreview />);
