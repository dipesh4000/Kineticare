import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = new Set();
const startup = new AbortController();
let stopping;

function stop(code = 0) {
  if (stopping) return stopping;
  startup.abort();
  process.exitCode = code;
  stopping = Promise.all([...children].map(child => new Promise(resolve => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return resolve();
    if (process.platform === 'win32') {
      const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
      killer.once('error', error => {
        console.error(`[ERROR] Could not stop ${child.pid}: ${error.message}`);
        child.kill();
        resolve();
      });
      killer.once('exit', resolve);
    } else {
      child.once('exit', resolve);
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      timer.unref();
      child.once('exit', () => clearTimeout(timer));
    }
  })));
  return stopping;
}

function available(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => reject(new Error(`Cannot use port ${port}: ${error.code}. Close the existing server or change PORT / FRONTEND_PORT in .env.`)));
    server.listen({ port, host: '127.0.0.1', exclusive: true }, () => server.close(resolve));
  });
}

async function waitUntilReady(url) {
  const deadline = Date.now() + 30000;
  while (!startup.signal.aborted && Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.any([startup.signal, AbortSignal.timeout(1500)]) });
      await response.body?.cancel();
      if (response.ok) return;
    } catch { /* Retry while the server starts. */ }
    await delay(200, undefined, { signal: startup.signal });
  }
  if (!startup.signal.aborted) throw new Error(`Startup timed out waiting for ${url}. Check the server errors above.`);
}

process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });

try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || major === 22 && minor < 12) throw new Error(`Node.js 22.12+ is required; found ${process.versions.node}. Install a supported Node.js release.`);
  process.chdir(root);
  if (existsSync('.env')) process.loadEnvFile('.env');
  if (existsSync('.env.groq')) process.loadEnvFile('.env.groq');
  const frontendPort = Number(process.env.FRONTEND_PORT ?? 3000);
  const backendPort = Number(process.env.PORT ?? 3001);
  for (const port of [frontendPort, backendPort]) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT and FRONTEND_PORT must be integers from 1 to 65535.');
  }
  if (frontendPort === backendPort) throw new Error('Frontend and backend must use different ports.');
  const viteEntry = existsSync('frontend/node_modules/vite/bin/vite.js') ? 'frontend/node_modules/vite/bin/vite.js' : 'node_modules/vite/bin/vite.js';
  for (const file of ['package.json', 'backend/server.js', 'frontend/vite.config.js']) {
    if (!existsSync(file)) throw new Error(`Missing project file: ${file}. Restore the project files and retry.`);
  }
  if (!existsSync('node_modules/express/package.json') || !existsSync(viteEntry)) throw new Error('Dependencies are missing. Run npm install in the project folder, then retry.');
  await Promise.all([available(frontendPort), available(backendPort)]);
  if (startup.signal.aborted) process.exit(0);
  const env = { ...process.env, HOST: '127.0.0.1', PORT: String(backendPort), API_PROXY_TARGET: `http://127.0.0.1:${backendPort}` };
  console.log('Starting Kineticare...');
  for (const [name, args] of [
    ['Backend', ['backend/server.js']],
    ['Frontend', [viteEntry, '--config', 'frontend/vite.config.js', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort', 'frontend']],
  ]) {
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
    children.add(child);
    child.once('error', error => {
      console.error(`[ERROR] ${name} could not start: ${error.message}`);
      void stop(1);
    });
    child.once('exit', (code, signal) => {
      children.delete(child);
      if (!stopping) {
        console.error(`[ERROR] ${name} stopped (${signal || `exit ${code}`}); shutting down both servers.`);
        void stop(code || 1);
      }
    });
  }
  await Promise.all([
    waitUntilReady(`http://127.0.0.1:${backendPort}/api/health`),
    waitUntilReady(`http://127.0.0.1:${frontendPort}/`),
    waitUntilReady(`http://127.0.0.1:${frontendPort}/api/health`),
  ]);
  if (!startup.signal.aborted) console.log(`\nKineticare is ready: http://localhost:${frontendPort}\nBackend: http://127.0.0.1:${backendPort}/api/health\nPress Ctrl+C to stop both servers.\n`);
} catch (error) {
  if (!startup.signal.aborted) {
    console.error(`[ERROR] ${error.message}`);
    await stop(1);
  }
}
