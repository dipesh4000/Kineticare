// The legacy MediaPipe peer publishes browser globals rather than ESM exports.
// Give pose-detection a real named export in both Vite dev and production builds.
import '@mediapipe/pose/pose.js';
export const Pose = globalThis.Pose;
