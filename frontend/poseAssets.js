import { createReadStream, readFileSync } from 'node:fs';

// Ship the installed, version-matched runtime with the app instead of depending
// on a third-party CDN at camera startup. Heavy is not exposed by the app.
export const poseAssetPath = 'pose/0.5.1675469404';
export const poseAssetFiles = ['pose.js', 'pose_web.binarypb', 'pose_solution_packed_assets_loader.js', 'pose_solution_packed_assets.data', 'pose_solution_simd_wasm_bin.js', 'pose_solution_simd_wasm_bin.wasm', 'pose_solution_simd_wasm_bin.data', 'pose_solution_wasm_bin.js', 'pose_solution_wasm_bin.wasm', 'pose_landmark_full.tflite', 'pose_landmark_lite.tflite'];
const asset = name => new URL(`./node_modules/@mediapipe/pose/${name}`, import.meta.url);

export function poseAssets() {
  return {
    name: 'bundled-pose-runtime',
    configureServer(server) {
      server.middlewares.use(`/${poseAssetPath}/`, (req, res, next) => {
        const name = req.url?.split('?')[0]?.replace(/^\//, '');
        if (!poseAssetFiles.includes(name)) return next();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : name.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
        const stream = createReadStream(asset(name));
        stream.on('error', next); stream.pipe(res);
      });
    },
    generateBundle() {
      for (const name of poseAssetFiles) this.emitFile({ type: 'asset', fileName: `${poseAssetPath}/${name}`, source: readFileSync(asset(name)) });
    },
  };
}
