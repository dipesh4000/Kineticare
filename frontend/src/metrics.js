export const avg = rows => {
  const scored = rows.filter(row => Number.isFinite(row.s));
  return scored.length
  ? +(scored.reduce((total, row) => total + row.s, 0) / scored.length).toFixed(2)
  : null;
};

export const exs = sessions => {
  const measurements = {};
  sessions.forEach(session => session.r.forEach(result => {
    (measurements[result.ex] ??= []).push(result);
  }));
  return Object.entries(measurements).map(([exercise, results]) => [
    exercise,
    avg(results),
    results.reduce((total, result) => total + result.t, 0) / results.length,
  ]);
};
