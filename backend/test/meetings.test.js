import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { validateMeeting } from '../services/meetingValidation.js';
import { createRecordsRouter } from '../routes/records.js';

test('meeting validation normalizes time and rejects unsafe links, past dates and invalid durations', () => {
  const now = Date.parse('2026-10-31T10:00:00Z');
  const body = { title: ' Check-in ', startsAt: '2026-10-31T16:00:00+05:30', durationMinutes: 30, patientId: 'p1', url: 'https://example.com/call' };
  assert.equal(validateMeeting(body, now).startsAt, '2026-10-31T10:30:00.000Z');
  assert.equal(validateMeeting(body, now).endsAt, '2026-10-31T11:00:00.000Z');
  assert.equal(validateMeeting(body, now).title, 'Check-in');
  for (const patch of [{ title: '' }, { startsAt: '2026-10-30T00:00:00Z' }, { startsAt: 'tomorrow' }, { durationMinutes: 0 }, { durationMinutes: 30.5 }, { url: 'javascript:alert(1)' }, { url: 'https://user:secret@example.com' }, { patientId: '../patient' }]) assert.throws(() => validateMeeting({ ...body, ...patch }, now));
});

test('meetings persist, appear only for their owner/linked patient, and enforce cancellation ownership', async () => {
  const tables = { users: [{ _id: 'p1', displayName: 'Test Patient' }], relationships: [{ _id: 'p1', clinicianUid: 'c1', active: true }], meetings: [], patientRecords: [] };
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => value && typeof value === 'object' && '$in' in value ? value.$in.includes(row[key]) : row[key] === value);
  const database = async () => ({ collection(name) {
    const rows = tables[name] ??= [];
    return {
      find(filter) { return { toArray: async () => rows.filter(row => matches(row, filter)).map(row => structuredClone(row)) }; },
      async findOne(filter) { return rows.find(row => matches(row, filter)) ?? null; },
      async insertOne(row) { rows.push(structuredClone(row)); },
      async updateOne(filter, update) { const row = rows.find(row => matches(row, filter)); if (!row) return { matchedCount: 0 }; Object.assign(row, update.$set); return { matchedCount: 1 }; },
    };
  } });
  const app = express(); app.use(express.json());
  app.use(createRecordsRouter({ database, authenticate(req, res, next) { if (!req.headers['x-user']) return res.sendStatus(401); req.identity = { uid: req.headers['x-user'], role: req.headers['x-role'], displayName: 'Test Clinician' }; next(); }, authorize: async (identity, id) => identity.uid === 'c1' && id === 'p1' }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (uid, role, path, body) => fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'x-user': uid, 'x-role': role, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const body = { title: 'Recovery review', patientId: 'p1', startsAt: new Date(Date.now() + 3600000).toISOString(), durationMinutes: 30 };
    assert.equal((await call('p1', 'patient', '/meetings', body)).status, 403);
    assert.equal((await call('c2', 'clinician', '/meetings', body)).status, 403);
    const response = await call('c1', 'clinician', '/meetings', { ...body, clinicianUid: 'spoofed' }); assert.equal(response.status, 201);
    const meeting = await response.json(); assert.equal(meeting.clinicianUid, 'c1');
    assert.equal((await (await call('c1', 'clinician', '/workspace')).json()).meetings.length, 1);
    assert.equal((await (await call('p1', 'patient', '/workspace')).json()).meetings.length, 1);
    assert.equal((await (await call('c2', 'clinician', '/workspace')).json()).meetings.length, 0);
    assert.equal((await call('c2', 'clinician', `/meetings/${meeting._id}/cancel`, {})).status, 404);
    assert.equal((await call('p1', 'patient', `/meetings/${meeting._id}/cancel`, {})).status, 403);
    assert.equal((await call('c1', 'clinician', `/meetings/${meeting._id}/cancel`, {})).status, 200);
    assert.equal(tables.meetings[0].status, 'cancelled');
    tables.relationships[0].active = false;
    assert.equal((await (await call('p1', 'patient', '/workspace')).json()).meetings.length, 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
