export const WORKSPACE_KEY = 'kineticare-workspace-v3';

export function patientEmail(value) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email)) {
    throw new Error('Enter a valid patient email address.');
  }
  return email;
}

export function sessionMode(results) {
  return results.some(result => result.mode === 'replay' || result.c?.startsWith('Replay demo')) ? 'replay' : 'live';
}

// Calendar days in the patient's device timezone; a missed day resets the streak.
export function workoutStreak(sessions, now = new Date()) {
  const day = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const today = day(now);
  const days = new Set(sessions.filter(session =>
    session.mode === 'live' && session.status === 'completed'
    && (session.r ?? session.exerciseResults ?? []).some(result =>
      result.assessedReps > 0 || result.reps?.length > 0),
  ).map(session => day(new Date(session.createdAt))).filter(value => Number.isFinite(value) && value <= today));
  let current = 0;
  let cursor = days.has(today) ? today : today - 1;
  while (days.has(cursor--)) current++;
  let best = 0;
  let run = 0;
  let previous;
  for (const value of [...days].sort((a, b) => a - b)) {
    run = value === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = value;
  }
  return { current, best, practicedToday: days.has(today) };
}
