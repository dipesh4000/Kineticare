import { POSE_MODES } from './poseOverlay.js';
import { loadPoseRuntime, withModelTimeout } from './modelLoading.js';

export async function createPoseDetector(mode = 'detailed') {
  return withModelTimeout(loadDetector(mode));
}

async function loadDetector(mode) {
  const selected = POSE_MODES[mode] ?? POSE_MODES.detailed;
  const [tf, poseDetection] = await Promise.all([
    import('@tensorflow/tfjs-core'),
    import('@tensorflow-models/pose-detection/dist/index.js'),
    import('@tensorflow/tfjs-backend-webgl'),
  ]);
  if (selected.model === 'BlazePose') {
    // Use the installed model's MediaPipe runtime: its TFJS/WebGL variant
    // produced non-finite coordinates on our browser verification device.
    const base = `${import.meta.env.BASE_URL}pose/0.5.1675469404`;
    await loadPoseRuntime(base);
    return poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
      runtime: 'mediapipe', modelType: selected.modelType, enableSmoothing: true,
      solutionPath: base,
    });
  }
  await tf.setBackend('webgl');
  await tf.ready();
  return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING, enableSmoothing: true });
}
