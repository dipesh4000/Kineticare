// The legacy MediaPipe peer publishes browser globals rather than ESM exports.
// Give pose-detection a real named export in both Vite dev and production builds.
export class Pose {
  constructor(options) {
    if (!globalThis.Pose) throw new Error('The pose runtime did not load. Retry camera setup.');
    return new globalThis.Pose(options);
  }
}
