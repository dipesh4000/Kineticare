export function withModelTimeout(pending, timeoutMs = 45000) {
  let timer;
  let expired = false;
  const guarded = Promise.resolve(pending).then(detector => {
    if (expired) { detector?.dispose(); throw new Error('Model loading timed out.'); }
    return detector;
  });
  return Promise.race([guarded, new Promise((_, reject) => {
    timer = setTimeout(() => { expired = true; reject(new Error('Tracking took too long to load. Check your connection or try Fast mode.')); }, timeoutMs);
  })]).finally(() => clearTimeout(timer));
}

let runtime;
export function loadPoseRuntime(base) {
  if (globalThis.Pose) return Promise.resolve();
  return runtime ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${base}/pose.js`;
    script.onload = () => { if (globalThis.Pose) resolve(); else { script.remove(); runtime = null; reject(new Error('The pose runtime is unavailable. Retry setup.')); } };
    script.onerror = () => { script.remove(); runtime = null; reject(new Error('Tracking files could not be downloaded. Check your connection and retry.')); };
    document.head.appendChild(script);
  });
}
