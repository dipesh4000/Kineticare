import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withAuthTimeout } from '../src/auth/withAuthTimeout.js';

test('auth operations return successful results and preserve verification errors', async () => {
  assert.equal(await withAuthTimeout(async () => 'verified'), 'verified');
  const invalidCode = new Error('Invalid verification code');
  await assert.rejects(withAuthTimeout(async () => { throw invalidCode; }), error => error === invalidCode);
});

test('a stalled sign-in releases the UI and late SDK completion is safely handled', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  await assert.rejects(withAuthTimeout(() => pending, 10), /taking too long/);
  finish('verified later');
  assert.equal(await pending, 'verified later');
  assert.equal(await withAuthTimeout(async () => 'retry works'), 'retry works');
});
