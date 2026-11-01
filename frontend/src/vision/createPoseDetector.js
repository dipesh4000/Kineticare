import { POSE_MODES } from './poseOverlay.js';
import { loadPoseRuntime, withModelTimeout, retryWithBackoff } from './modelLoading.js';
import { mapError } from '../services/errorMapping.js';

export async function createPoseDetector(mode = 'detailed') {
  return withModelTimeout(loadDetector(mode));
}

/**
 * Initializes TensorFlow backend with resilient fallback:
 * 1. WebGL (hardware accelerated)
 * 2. WASM / CPU (software fallback)
 * 3. Clear unsupported-device message if all fail.
 */
export async function initializeBackend(tf) {
  // 1. Try WebGL first
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    return { backend: 'webgl', fallback: false };
  } catch (webglErr) {
    console.warn('WebGL backend unavailable or blocked, falling back to WASM/CPU:', webglErr);
  }

  // 2. Fall back to WASM (if registered) or CPU
  try {
    const hasWasm = typeof tf.findBackend === 'function' && tf.findBackend('wasm');
    const fallbackBackend = hasWasm ? 'wasm' : 'cpu';
    await tf.setBackend(fallbackBackend);
    await tf.ready();
    return { backend: fallbackBackend, fallback: true, warning: 'WebGL hardware acceleration is unavailable. Running in lightweight CPU/WASM mode.' };
  } catch (cpuErr) {
    console.error('All TensorFlow backends failed:', cpuErr);
    const err = new Error('Your browser or device does not support on-device pose estimation.');
    err.code = 'UNSUPPORTED_DEVICE';
    throw err;
  }
}

/**
 * Attaches listeners for WebGL context loss and recovery.
 */
export function attachWebGLContextLossListener(canvas, onLost, onRestored) {
  if (!canvas || typeof canvas.addEventListener !== 'function') return () => {};

  const handleLost = event => {
    event.preventDefault();
    console.warn('WebGL context lost detected on canvas.');
    onLost?.(mapError({ code: 'WEBGL_CONTEXT_LOST' }));
  };

  const handleRestored = () => {
    console.info('WebGL context restored.');
    onRestored?.();
  };

  canvas.addEventListener('webglcontextlost', handleLost, false);
  canvas.addEventListener('webglcontextrestored', handleRestored, false);

  return () => {
    canvas.removeEventListener('webglcontextlost', handleLost, false);
    canvas.removeEventListener('webglcontextrestored', handleRestored, false);
  };
}

async function loadDetector(mode) {
  const selected = POSE_MODES[mode] ?? POSE_MODES.detailed;

  const [tf, poseDetection] = await Promise.all([
    import('@tensorflow/tfjs-core'),
    import('@tensorflow-models/pose-detection/dist/index.js'),
    import('@tensorflow/tfjs-backend-webgl'),
  ]);

  if (selected.model === 'BlazePose') {
    const rawBase = import.meta.env.BASE_URL || '/';
    const localBase = `${rawBase.endsWith('/') ? rawBase : `${rawBase}/`}pose/0.5.1675469404`;
    const cdnBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404';

    try {
      let solutionPath = localBase;
      try {
        await loadPoseRuntime(localBase, cdnBase);
      } catch (localRuntimeErr) {
        console.warn('Local pose runtime unavailable, trying CDN solutionPath:', localRuntimeErr);
        solutionPath = cdnBase;
        await loadPoseRuntime(cdnBase);
      }

      const detector = await retryWithBackoff(() => poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
        runtime: 'mediapipe',
        modelType: selected.modelType,
        enableSmoothing: true,
        solutionPath,
      }), { maxRetries: 2, initialDelayMs: 400 });

      return detector;
    } catch (blazePoseErr) {
      console.warn('BlazePose detector failed to initialize (common in restricted WebViews or mobile environments). Gracefully falling back to MoveNet (Fast mode):', blazePoseErr);
      // Seamlessly fall back to MoveNet
      await initializeBackend(tf);
      const fallbackDetector = await retryWithBackoff(() => poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
      }), { maxRetries: 2, initialDelayMs: 500 });
      fallbackDetector.fallbackMode = 'fast';
      return fallbackDetector;
    }
  }

  // MoveNet: Initialize WebGL with WASM/CPU fallback
  await initializeBackend(tf);

  return retryWithBackoff(() => poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: true,
  }), { maxRetries: 3, initialDelayMs: 600 });
}
