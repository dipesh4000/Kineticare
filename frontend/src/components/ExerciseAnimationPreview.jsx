import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { miniSquatPose, sideArmRaisePose, SKELETON_SEGMENTS, validateIllustrativeDescriptor } from '../exercise/illustrativeMotion';

export default function ExerciseAnimationPreview({ descriptor, initialPeak, compact = false }) {
  const hostRef = useRef(null);
  const controlsRef = useRef(null);
  const isArm = descriptor?.id === 'side-arm-raise-illustration-v1';
  const title = isArm ? 'Side arm raise' : 'Mini-squat';
  const [peak, setPeak] = useState(initialPeak ?? (isArm ? 75 : 30));
  const [poseStats, setPoseStats] = useState({ angle: 0, phase: 'Rest position' });
  const [duration, setDuration] = useState(6);
  const [view, setView] = useState(isArm ? 'front' : 'oblique');
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [recording, setRecording] = useState(false);
  const [video, setVideo] = useState(null);
  const [error, setError] = useState('');
  const supported = validateIllustrativeDescriptor(descriptor);

  useEffect(() => {
    if (!supported) return undefined;
    const host = hostRef.current;
    let active = true;
    let renderer;
    let stopCapture;
    let frameId;
    let observer;
    let elapsed = 0;
    let previous = null;
    let running = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let statsAt = 0;
    const getPose = isArm ? sideArmRaisePose : miniSquatPose;
    let recordingEnd = null;
    let recorder;
    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101c30');
    scene.add(new THREE.HemisphereLight('#e3efff', '#425578', 2.4));
    const light = new THREE.DirectionalLight('#ffffff', 3); light.position.set(3, 5, 4); scene.add(light);
    const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 30);
    camera.position.set(...(view === 'front' ? [0, 1.3, 4.4] : view === 'side' ? [4.4, 1.3, 0] : [3.1, 1.7, 3.4]));
    camera.lookAt(0, 0.95, 0);
    const jointGeometry = new THREE.SphereGeometry(0.035, 12, 8);
    const jointMaterial = new THREE.MeshStandardMaterial({ color: '#c7d8f1', roughness: 0.45 });
    const jointMeshes = new Map();
    const boneGeometry = new THREE.CylinderGeometry(1, 1, 1, 16);
    const boneMaterial = new THREE.MeshStandardMaterial({ color: '#8274f4', roughness: 0.42, metalness: 0.12 });
    const boneMeshes = SKELETON_SEGMENTS.map(() => { const mesh = new THREE.Mesh(boneGeometry, boneMaterial); scene.add(mesh); return mesh; });
    const bodyGeometry = new THREE.SphereGeometry(1, 24, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#e8eef9', roughness: 0.6 });
    const torso = new THREE.Mesh(bodyGeometry, bodyMaterial); torso.scale.set(0.21, 0.30, 0.12); scene.add(torso);
    const pelvisMesh = new THREE.Mesh(bodyGeometry, boneMaterial); pelvisMesh.scale.set(0.19, 0.12, 0.13); scene.add(pelvisMesh);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.35, 64), new THREE.MeshStandardMaterial({ color: '#1b2c46', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.005; scene.add(floor);
    const grid = new THREE.GridHelper(2.7, 12, '#40516d', '#263954'); scene.add(grid);
    const axis = new THREE.Vector3(0, 1, 0);
    const from = new THREE.Vector3(), to = new THREE.Vector3(), direction = new THREE.Vector3();
    const composite = document.createElement('canvas');
    composite.width = 960;
    composite.height = 600;
    const painter = composite.getContext('2d');
    function dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      stopCapture?.(new Error('Video recording stopped because the preview closed.'));
      renderer?.setAnimationLoop(null);
      renderer?.dispose();
      jointGeometry.dispose(); jointMaterial.dispose(); boneGeometry.dispose(); boneMaterial.dispose(); bodyGeometry.dispose(); bodyMaterial.dispose(); floor.geometry.dispose(); floor.material.dispose();
      grid.geometry.dispose();
      for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) material.dispose();
      renderer?.domElement.remove();
      controlsRef.current = null;
    }
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.setAttribute('aria-label', `Illustrative ${title} 3D movement preview`);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      host.appendChild(renderer.domElement);
      const resize = () => { const width = Math.max(host.clientWidth, 160); renderer.setSize(width, width * 3 / 4, false); };
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      const initial = getPose(0, duration, peak);
      for (const name of Object.keys(initial.points)) {
        const mesh = new THREE.Mesh(jointGeometry, jointMaterial);
        if (name === 'head') mesh.scale.set(3.2, 3.8, 3.1);
        jointMeshes.set(name, mesh);
        scene.add(mesh);
      }
      function paint(timestamp) {
        if (!active) return;
        if (previous !== null && running) elapsed += Math.min((timestamp - previous) / 1000, 0.1);
        previous = timestamp;
        const pose = getPose(elapsed, duration, peak);
        for (const [name, mesh] of jointMeshes) mesh.position.set(...pose.points[name]);
        for (let i = 0; i < SKELETON_SEGMENTS.length; i++) {
          const [a, b] = SKELETON_SEGMENTS[i];
          from.set(...pose.points[a]); to.set(...pose.points[b]); direction.subVectors(to, from);
          const mesh = boneMeshes[i];
          const radius = a.includes('Hip') || a.includes('Knee') ? 0.055 : a.includes('Ankle') || a.includes('Toe') || a.includes('Heel') ? 0.025 : 0.038;
          mesh.position.copy(from).add(to).multiplyScalar(0.5);
          mesh.scale.set(radius, direction.length(), radius);
          mesh.quaternion.setFromUnitVectors(axis, direction.normalize());
        }
        torso.position.set(0, pose.points.pelvis[1] + 0.32, pose.points.pelvis[2]);
        pelvisMesh.position.set(...pose.points.pelvis);
        if (timestamp - statsAt > 120) { statsAt = timestamp; setPoseStats({ angle: Math.round(pose.shoulderDegrees ?? pose.kneeFlexionDegrees), phase: pose.phaseName }); }
        renderer.render(scene, camera);
        if (recorder?.state === 'recording') {
          painter.fillStyle = '#f1f5f9'; painter.fillRect(0, 0, 960, 600);
          painter.drawImage(renderer.domElement, 120, 0, 720, 540);
          painter.fillStyle = '#1e2653'; painter.font = 'bold 20px sans-serif';
          painter.fillText(`Kineticare | ${title} — illustrative motion for review`, 20, 567);
          painter.font = '16px sans-serif';
          painter.fillText(`${pose.phaseName} | Synthetic geometry | Demonstration setting: ${peak}° | Not a patient prescription`, 20, 592);
          if (recordingEnd !== null && elapsed >= recordingEnd) recorder.stop();
        }
        frameId = requestAnimationFrame(paint);
      }
      controlsRef.current = {
        toggle() { running = !running; return !running; },
        capture() {
          if (recorder?.state === 'recording') return Promise.reject(new Error('A video is already recording.'));
          if (!painter || !composite.captureStream || typeof MediaRecorder === 'undefined') return Promise.reject(new Error('This browser cannot export canvas video.'));
          const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
          if (!mimeType) return Promise.reject(new Error('No supported video export format is available in this browser.'));
          return new Promise((resolve, reject) => {
            const chunks = [];
            const stream = composite.captureStream(30);
            let finished = false;
            const finish = error => {
              if (finished) return;
              finished = true;
              if (recorder?.state === 'recording') recorder.stop();
              stream.getTracks().forEach(track => track.stop());
              stopCapture = null;
              recordingEnd = null;
              if (error) reject(error);
              else if (!chunks.length) reject(new Error('The browser returned an empty video.'));
              else resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
            };
            stopCapture = finish;
            try {
              recorder = new MediaRecorder(stream, { mimeType });
              recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
              recorder.onerror = () => finish(new Error('Video export failed. Try a different supported browser.'));
              recorder.onstop = () => finish();
              elapsed = 0; previous = null; running = true; recordingEnd = duration;
              recorder.start(100);
            } catch (error) { finish(error); }
          });
        },
      };
      frameId = requestAnimationFrame(paint);
    } catch {
      dispose();
      queueMicrotask(() => { if (host.isConnected) setError('The 3D preview could not start. Enable WebGL or try another browser.'); });
    }
    return dispose;
  }, [supported, peak, duration, view, isArm, title]);

  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);

  async function exportVideo() {
    setError(''); setRecording(true); setPaused(false);
    try {
      if (!controlsRef.current) throw new Error('Wait for the preview to load.');
      const blob = await controlsRef.current.capture();
      setVideo({ url: URL.createObjectURL(blob), extension: blob.type.includes('mp4') ? 'mp4' : 'webm' });
    } catch (cause) { setError(cause.message); }
    finally { setRecording(false); }
  }

  if (!supported) return <p>No compatible illustrative motion is available for this exercise.</p>;
  return <section className="motion-preview" aria-label={`${title} animation preview`}>
    {!compact && <div className="row sp"><h3>{title} · movement preview</h3><span className="tag">Illustrative 3D</span></div>}
    <div className="motion-stage"><div ref={hostRef} className="motion-canvas" /><div className="motion-hud"><span>{poseStats.phase}</span><b>{poseStats.angle}° <small>/ {peak}°</small></b></div><span className="motion-view-label">{view} view · {duration}s cycle</span></div>
    <div className="motion-controls">
      {!compact && <label>{isArm ? 'Preview arm height' : 'Preview knee flexion'}<select value={peak} disabled={recording} onChange={event => { setPeak(Number(event.target.value)); setPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }}>{(isArm ? [30, 45, 60, 75, 90, 120] : [30, 45]).map(value => <option key={value} value={value}>{value}°</option>)}</select></label>}
      <label>Tempo<select value={duration} disabled={recording} onChange={event => { setDuration(Number(event.target.value)); setPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }}><option value="3">3s cycle</option><option value="6">6s cycle</option><option value="12">12s cycle</option></select></label>
      <label>Camera angle<select value={view} disabled={recording} onChange={event => { setView(event.target.value); setPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }}><option value="front">Front</option><option value="oblique">3/4 view</option><option value="side">Side</option></select></label>
    </div>
    <div className="row"><button type="button" className="btn s" aria-pressed={paused} disabled={recording} onClick={() => { if (controlsRef.current) setPaused(controlsRef.current.toggle()); }}>{paused ? 'Play animation' : 'Pause animation'}</button>{!compact && <button type="button" className="btn" disabled={recording} onClick={exportVideo}>{recording ? 'Rendering one cycle…' : 'Export preview video'}</button>}</div>
    <p className="mut">{isArm ? `Raise both arms out to ${peak}°, then lower fully to count one rep.` : '30–45° is the source-scoped demonstration range.'} Synthetic movement preview; follow your assigned range. {compact ? '' : 'Exporting a preview does not approve it for patient assignment.'}</p>
    {video && <div><video src={video.url} controls playsInline style={{ width: '100%', marginTop: 16 }} /><a className="btn s" href={video.url} download={`kineticare-${isArm ? 'arm-raise' : 'mini-squat'}-illustration.${video.extension}`}>Download preview video</a></div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
