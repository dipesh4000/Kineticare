import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const entry = fileURLToPath(new URL('launch.mjs', import.meta.url));
function run(env, cmd = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd ? process.env.ComSpec || 'cmd.exe' : process.execPath,
      cmd ? ['/d', '/s', '/c', `""${fileURLToPath(new URL('../Launch-Kineticare.cmd', import.meta.url))}""`] : [entry],
      { cwd: tmpdir(), env: { ...process.env, KINETICARE_NO_PAUSE: '1', ...env }, windowsHide: true, windowsVerbatimArguments: cmd, timeout: 10000 });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, output }));
  });
}

test('rejects invalid and duplicate ports before starting servers, from another directory', async () => {
  for (const port of ['0', '65536', 'abc', '3000.5', '']) {
    const result = await run({ PORT: port, FRONTEND_PORT: '3330' });
    assert.equal(result.code, 1);
    assert.match(result.output, /must be integers/);
  }
  const result = await run({ PORT: '3330', FRONTEND_PORT: '3330' });
  assert.equal(result.code, 1);
  assert.match(result.output, /different ports/);
});

test('rejects an occupied port and leaves its owner running', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await run({ PORT: String(server.address().port), FRONTEND_PORT: '3330' });
    assert.equal(result.code, 1);
    assert.match(result.output, /Cannot use port/);
    assert.ok(server.listening);
    assert.doesNotMatch(result.output, /Starting Kineticare/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('CMD preserves the failing exit code without pausing', { skip: process.platform !== 'win32' }, async () => {
  const result = await run({ PORT: 'invalid' }, true);
  assert.equal(result.code, 1);
  assert.match(result.output, /must be integers/);
});
