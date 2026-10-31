import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const useCmd = process.argv.includes('--cmd');
const command = useCmd ? process.env.ComSpec || 'cmd.exe' : fileURLToPath(new URL('../Launch-Kineticare.exe', import.meta.url));
const args = useCmd ? ['/d', '/c', 'Launch-Kineticare.cmd'] : [];
const launcher = spawn(command, args, { cwd: root, env: { ...process.env, PORT: '3331', FRONTEND_PORT: '3330', KINETICARE_NO_PAUSE: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
let spawnError;
launcher.on('error', error => { spawnError = error; });
launcher.stdout.on('data', chunk => { output += chunk; });
launcher.stderr.on('data', chunk => { output += chunk; });
try {
  const deadline = Date.now() + 40000;
  let ready = false;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (launcher.exitCode != null) throw new Error('Launcher exited before startup.');
    try {
      const health = await fetch('http://127.0.0.1:3331/api/health', { signal: AbortSignal.timeout(1500) });
      const page = await fetch('http://127.0.0.1:3330/', { signal: AbortSignal.timeout(1500) });
      const proxy = await fetch('http://127.0.0.1:3330/api/health', { signal: AbortSignal.timeout(1500) });
      if (health.ok && page.ok && proxy.ok && output.includes('Kineticare is ready:')) { ready = true; break; }
    } catch { /* Servers may still be starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Both servers and Vite API proxy must become ready.');
  assert.equal((await fetch('http://127.0.0.1:3330/api/records/workspace', { signal: AbortSignal.timeout(1500) })).status, 401);
  console.log(`PASS: ${useCmd ? 'CMD' : 'compiled'} launcher started frontend, backend, authenticated record boundary and API proxy after readiness checks.`);
} catch (error) {
  console.error(error.message);
  console.error(output);
  process.exitCode = 1;
} finally {
  // This PID is the test-owned launcher; never stop an unrelated development server.
  if (launcher.pid) spawnSync('taskkill', ['/pid', String(launcher.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
}
