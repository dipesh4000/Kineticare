export function calibrateRest(values, { minimumSamples = 10, maximumSpread = 8 } = {}) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (valid.length < minimumSamples) return { ok: false, reason: 'Keep the required joints visible for two seconds.' };
  if (valid.at(-1) - valid[0] > maximumSpread) return { ok: false, reason: 'Hold the resting position still and retry.' };
  const middle = Math.floor(valid.length / 2);
  const value = valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
  return { ok: true, value };
}
