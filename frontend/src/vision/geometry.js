export function angleAt(a, vertex, c) {
  if (![a, vertex, c].every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))) return null;
  const first = { x: a.x - vertex.x, y: a.y - vertex.y };
  const second = { x: c.x - vertex.x, y: c.y - vertex.y };
  const scale = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  if (!scale) return null;
  const cosine = Math.max(-1, Math.min(1, (first.x * second.x + first.y * second.y) / scale));
  return Math.acos(cosine) * 180 / Math.PI;
}

export function namedKeypoints(keypoints) {
  return Object.fromEntries(keypoints.map(point => [point.name, point]));
}

export function visible(points, minimumScore = 0.3) {
  return points.every(point => point && Number.isFinite(point.score) && point.score >= minimumScore);
}
