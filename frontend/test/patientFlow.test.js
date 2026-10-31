import test from 'node:test';
import assert from 'node:assert/strict';
import { patientEmail, sessionMode, workoutStreak } from '../src/patientFlow.js';

const workout = (date, change = {}) => ({
  createdAt: `${date}T12:00:00`, mode: 'live', status: 'completed', r: [{ assessedReps: 5 }], ...change,
});
const today = new Date('2026-10-22T18:00:00');

test('onboarding normalizes email and rejects invalid document identifiers', () => {
  assert.equal(patientEmail(' Patient@Example.COM '), 'patient@example.com');
  for (const email of ['', 'bad', 'a/b@example.com', 'a@b', 'a b@example.com']) assert.throws(() => patientEmail(email));
});

test('replay results remain replay even in mixed or interrupted workouts', () => {
  assert.equal(sessionMode([{ c: 'Camera measured' }]), 'live');
  assert.equal(sessionMode([{ c: 'Replay demo (simulated)' }]), 'replay');
  assert.equal(sessionMode([{ mode: 'live' }, { c: 'Replay demo' }]), 'replay');
});

test('streak counts unique calendar days and preserves yesterday until today ends', () => {
  const history = ['2026-10-20', '2026-10-21', '2026-10-21'].map(date => workout(date));
  assert.deepEqual(workoutStreak(history, today), { current: 2, best: 2, practicedToday: false });
  assert.deepEqual(workoutStreak([...history, workout('2026-10-22')], today), { current: 3, best: 3, practicedToday: true });
});

test('streak excludes replay, partial, unmeasured, invalid and future sessions', () => {
  const history = [
    workout('2026-10-22', { mode: 'replay' }), workout('2026-10-22', { status: 'partial' }),
    workout('2026-10-22', { r: [] }), workout('2026-10-23'), workout('invalid'),
  ];
  assert.deepEqual(workoutStreak(history, today), { current: 0, best: 0, practicedToday: false });
  assert.deepEqual(workoutStreak(['2026-10-18', '2026-10-19', '2026-10-20'].map(date => workout(date)), today), { current: 0, best: 3, practicedToday: false });
});

test('streak handles month and year boundaries', () => {
  assert.equal(workoutStreak(['2025-12-31', '2026-01-01'].map(date => workout(date)), new Date('2026-01-01T23:59:00')).current, 2);
});
