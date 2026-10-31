// Lightweight performance / memory log for live camera sessions.
// Samples JS heap (Chromium only), TensorFlow.js tensor memory and pose frame rate every 2 s,
// and stores the last 20 runs in localStorage so memory use can be reviewed or downloaded.
const KEY = 'kineticare-perf-log';
const MAX_RUNS = 20;
const mb = bytes => (Number.isFinite(bytes) ? +(bytes / 1048576).toFixed(1) : null);

export function readPerfLog() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; }
}
export function clearPerfLog() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

function deviceInfo() {
  return {
    userAgent: navigator.userAgent,
    cores: navigator.hardwareConcurrency ?? null,
    deviceMemoryGb: navigator.deviceMemory ?? null,
    screen: `${screen.width}x${screen.height}`,
    heapLimitMb: mb(performance.memory?.jsHeapSizeLimit),
  };
}

export function startProfiler(label) {
  const run = { id: `${Date.now()}`, label, startedAt: new Date().toISOString(), device: deviceInfo(), samples: [] };
  let frames = 0;
  let lastAt = performance.now();
  const sample = async () => {
    const now = performance.now();
    const fps = +(frames / ((now - lastAt) / 1000)).toFixed(1);
    frames = 0; lastAt = now;
    let tf = null;
    try {
      const core = await import('@tensorflow/tfjs-core');
      const info = core.memory();
      tf = { tensors: info.numTensors, mb: mb(info.numBytes), backend: core.getBackend() };
    } catch { /* model not loaded yet */ }
    run.samples.push({ t: Math.round((now - run.t0) / 1000), heapUsedMb: mb(performance.memory?.usedJSHeapSize), fps, tf });
  };
  run.t0 = performance.now();
  const id = setInterval(sample, 2000);
  let stopped = false;
  const handle = {
    tick: () => { frames += 1; },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(id);
      window.removeEventListener('pagehide', handle.stop);
      if (!run.samples.length) return;
      const heap = run.samples.map(item => item.heapUsedMb).filter(Number.isFinite);
      const fpsList = run.samples.map(item => item.fps);
      run.summary = {
        seconds: run.samples.at(-1).t,
        heapStartMb: heap[0] ?? null, heapPeakMb: heap.length ? Math.max(...heap) : null, heapEndMb: heap.at(-1) ?? null,
        avgFps: +(fpsList.reduce((a, b) => a + b, 0) / fpsList.length).toFixed(1),
      };
      delete run.t0;
      try { localStorage.setItem(KEY, JSON.stringify([run, ...readPerfLog()].slice(0, MAX_RUNS))); } catch { /* quota */ }
    },
  };
  window.addEventListener('pagehide', handle.stop);
  return handle;
}
