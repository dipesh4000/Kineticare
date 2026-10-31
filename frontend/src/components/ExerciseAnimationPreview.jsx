import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { miniSquatPose, SKELETON_SEGMENTS, validateIllustrativeDescriptor } from '../exercise/illustrativeMotion';

export default function ExerciseAnimationPreview({ descriptor }) {
  const hostRef = useRef(null);
  const controlsRef = useRef(null);
  const [peak, setPeak] = useState(30);
  const [duration, setDuration] = useState(6);
  const [view, setView] = useState('oblique');
  const [paused, setPaused] = useState(false);
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
    let running = true;
    let recordingEnd = null;
    let recorder;
    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f1f5f9');
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 30);
    camera.position.set(...(view === 'front' ? [0, 1.3, 4.4] : view === 'side' ? [4.4, 1.3, 0] : [3.1, 1.7, 3.4]));
    camera.lookAt(0, 0.95, 0);
    const jointGeometry = new THREE.SphereGeometry(0.035, 12, 8);
    const jointMaterial = new THREE.MeshBasicMaterial({ color: '#1e2653' });
    const jointMeshes = new Map();
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(SKELETON_SEGMENTS.length * 6);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: '#0d825e' });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    // Animated geometry must not be culled using its initial, all-zero bounds.
    lines.frustumCulled = false;
    scene.add(lines);
    const grid = new THREE.GridHelper(3, 12, '#94a3b8', '#cbd5e1');
    scene.add(grid);
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
      jointGeometry.dispose(); jointMaterial.dispose(); lineGeometry.dispose(); lineMaterial.dispose();
      grid.geometry.dispose();
      for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) material.dispose();
      renderer?.domElement.remove();
      controlsRef.current = null;
    }
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.setAttribute('aria-label', 'Illustrative mini-squat skeleton preview');
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      host.appendChild(renderer.domElement);
      const resize = () => { const width = Math.max(host.clientWidth, 280); renderer.setSize(width, width * 9 / 16, false); };
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      const initial = miniSquatPose(0, duration, peak);
      for (const name of Object.keys(initial.points)) {
        const mesh = new THREE.Mesh(jointGeometry, jointMaterial);
        if (name === 'head') mesh.scale.setScalar(2.2);
        jointMeshes.set(name, mesh);
        scene.add(mesh);
      }
      function paint(timestamp) {
        if (!active) return;
        if (previous !== null && running) elapsed += Math.min((timestamp - previous) / 1000, 0.1);
        previous = timestamp;
        const pose = miniSquatPose(elapsed, duration, peak);
        for (const [name, mesh] of jointMeshes) mesh.position.set(...pose.points[name]);
        for (let i = 0; i < SKELETON_SEGMENTS.length; i++) {
          const [a, b] = SKELETON_SEGMENTS[i];
          linePositions.set(pose.points[a], i * 6);
          linePositions.set(pose.points[b], i * 6 + 3);
        }
        lineGeometry.attributes.position.needsUpdate = true;
        renderer.render(scene, camera);
        if (recorder?.state === 'recording') {
          painter.fillStyle = '#f1f5f9'; painter.fillRect(0, 0, 960, 600);
          painter.drawImage(renderer.domElement, 0, 0, 960, 540);
          painter.fillStyle = '#1e2653'; painter.font = 'bold 20px sans-serif';
          painter.fillText('Kineticare | Illustrative mini-squat — clinician review pending', 20, 567);
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
  }, [supported, peak, duration, view]);

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
  return <section aria-label="Exercise animation preview">
    <h3>Mini-squat animation preview</h3>
    <p className="mut">Illustrative skeleton for clinician review. Synthetic proportions and motion interpolation; not an approved patient demonstration.</p>
    <div className="row" style={{ flexWrap: 'wrap', alignItems: 'end', marginBottom: 12 }}>
      <label>Demonstration knee flexion<select value={peak} disabled={recording} onChange={event => { setPeak(Number(event.target.value)); setPaused(false); }}><option value="30">30°</option><option value="45">45°</option></select></label>
      <label>Preview cycle (seconds)<select value={duration} disabled={recording} onChange={event => { setDuration(Number(event.target.value)); setPaused(false); }}><option value="3">3</option><option value="6">6</option><option value="12">12</option></select></label>
      <label>View<select value={view} disabled={recording} onChange={event => { setView(event.target.value); setPaused(false); }}><option value="oblique">Oblique</option><option value="front">Front</option><option value="side">Side</option></select></label>
    </div>
    <div ref={hostRef} style={{ width: '100%', minHeight: 180, borderRadius: 12, overflow: 'hidden', background: '#f1f5f9' }} />
    <p className="mut">30–45° is the cited initial mini-squat range, not an individual target. Cycle time is a presentation choice.</p>
    <div className="row"><button type="button" className="btn s" disabled={recording} onClick={() => { if (controlsRef.current) setPaused(controlsRef.current.toggle()); }}>{paused ? 'Play' : 'Pause'}</button><button type="button" className="btn" disabled={recording} onClick={exportVideo}>{recording ? 'Rendering one cycle…' : 'Render video'}</button></div>
    {video && <div><video src={video.url} controls playsInline style={{ width: '100%', marginTop: 16 }} /><a className="btn s" href={video.url} download={`kineticare-mini-squat-illustration.${video.extension}`}>Download preview video</a></div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
