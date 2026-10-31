import test from 'node:test';
import assert from 'node:assert/strict';
import { centeredDays, localDayKey, meetingsOnDay } from '../src/calendar.js';
import { withModelTimeout } from '../src/vision/modelLoading.js';

test('today is always the middle of seven dates across month and year boundaries', () => {
  for (const center of [new Date(2026, 9, 31), new Date(2027, 0, 1), new Date(2028, 1, 29)]) {
    const days = centeredDays(center);
    assert.equal(days.length, 7);
    assert.equal(localDayKey(days[3]), localDayKey(center));
    assert.equal(new Set(days.map(localDayKey)).size, 7);
    for (let i = 1; i < 7; i++) assert.equal(new Date(days[i - 1].getFullYear(), days[i - 1].getMonth(), days[i - 1].getDate() + 1).getTime(), days[i].getTime());
  }
});

test('calendar includes cross-midnight appointments and excludes cancelled meetings', () => {
  const date = new Date(2026, 9, 31);
  const meeting = { status: 'scheduled', startsAt: new Date(2026, 9, 30, 23, 45).toISOString(), endsAt: new Date(2026, 9, 31, 0, 15).toISOString() };
  assert.equal(meetingsOnDay([meeting], date).length, 1);
  assert.equal(meetingsOnDay([{ ...meeting, status: 'cancelled' }], date).length, 0);
  assert.equal(meetingsOnDay([meeting], new Date(2026, 10, 1)).length, 0);
});

test('model startup times out and disposes a detector that finishes after timeout', async () => {
  let finish;
  let disposed = false;
  const pending = new Promise(resolve => { finish = resolve; });
  await assert.rejects(withModelTimeout(pending, 5), /too long to load/);
  finish({ dispose() { disposed = true; } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(disposed, true);
  const detector = { dispose() {} };
  assert.equal(await withModelTimeout(Promise.resolve(detector), 100), detector);
  await assert.rejects(withModelTimeout(Promise.reject(new Error('Download failed')), 100), /Download failed/);
});
