import { mergeConfig } from 'vite';
import base from '../vite.config.js';

// Compile the real model loader and synthetic UI fixtures with production tree
// shaking. Serve dist/verification as its own root; never publish it as the app.
export default mergeConfig(base, {
  build: {
    outDir: 'dist/verification',
    rollupOptions: { input: { pose: 'test/pose-model-preview.html', flows: 'test/mobile-ux-preview.html' } },
  },
});
