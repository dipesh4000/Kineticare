import test from 'node:test';
import assert from 'node:assert/strict';
import { sendInvitationEmail } from '../services/invitationEmail.js';

test('invitation email requires server configuration, sends a signup link and reports provider failure', async t => {
  const keys = ['RESEND_API_KEY', 'INVITATION_FROM_EMAIL', 'APP_URL'];
  const original = keys.map(key => process.env[key]);
  const originalFetch = globalThis.fetch;
  t.after(() => {
    keys.forEach((key, index) => { if (original[index] === undefined) delete process.env[key]; else process.env[key] = original[index]; });
    globalThis.fetch = originalFetch;
  });
  const invite = { email: 'patient@example.test', patientName: 'Patient', clinicianName: 'Doctor', code: 'a'.repeat(32) };
  keys.forEach(key => { delete process.env[key]; });
  globalThis.fetch = async () => { assert.fail('Unconfigured email must not call the provider'); };
  await assert.rejects(sendInvitationEmail(invite), { status: 503 });
  process.env.RESEND_API_KEY = 'test-key';
  process.env.INVITATION_FROM_EMAIL = 'Kineticare <care@example.test>';
  process.env.APP_URL = 'https://kineticare.example.test';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.to, [invite.email]);
    assert.equal(body.from, process.env.INVITATION_FROM_EMAIL);
    assert.ok(body.text.includes(`https://kineticare.example.test/?invite=${invite.code}`));
    assert.ok(body.text.includes('No records are shared until you consent.'));
    return { ok: true };
  };
  await sendInvitationEmail(invite);
  globalThis.fetch = async () => ({ ok: false });
  await assert.rejects(sendInvitationEmail(invite), { status: 502 });
});
