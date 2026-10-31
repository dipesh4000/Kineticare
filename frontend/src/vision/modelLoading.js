/**
 * Resilient model loading utilities with timeout protection,
 * exponential backoff retry for network assets, and hardware fallback.
 */

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

/**
 * Retries an asynchronous operation with exponential backoff.
 */
export async function retryWithBackoff(fn, { maxRetries = 3, initialDelayMs = 500, backoffFactor = 2 } = {}) {
  let delay = initialDelayMs;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= backoffFactor;
    }
  }
  throw lastError;
}

let runtime;
export function loadPoseRuntime(base) {
  if (globalThis.Pose) return Promise.resolve();
  return runtime ??= retryWithBackoff(() => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${base}/pose.js`;
    script.onload = () => {
      if (globalThis.Pose) resolve();
      else {
        script.remove();
        runtime = null;
        reject(new Error('The pose runtime is unavailable. Retry setup.'));
      }
    };
    script.onerror = () => {
      script.remove();
      runtime = null;
      reject(new Error('Tracking files could not be downloaded. Check your connection and retry.'));
    };
    document.head.appendChild(script);
  }), { maxRetries: 3, initialDelayMs: 600 });
}
