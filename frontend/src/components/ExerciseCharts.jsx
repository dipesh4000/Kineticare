import { ALL_EXERCISES } from '../data';

const shortName = name => name.replace('Side ', '');

function BarChart({ title, rows, max = 0 }) {
  const W = 320, H = 190, L = 10, base = 150, top = 28, gap = 22;
  const bw = (W - L * 2 - gap * (rows.length - 1)) / rows.length;
  const scale = Math.max(max, ...rows.map(row => row.value), 1);
  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 520, display: 'block' }} role="img" aria-label={`${title}: ${rows.map(row => `${row.label} ${row.text}`).join(', ')}`}>
        {[0, 0.5, 1].map(fraction => <line key={fraction} x1={L} x2={W - L} y1={base - (base - top) * fraction} y2={base - (base - top) * fraction} stroke="#8883" />)}
        {rows.map((row, index) => {
          const x = L + index * (bw + gap);
          const height = (base - top) * row.value / scale;
          return (
            <g key={row.label}>
              <rect x={x} y={base - height} width={bw} height={row.value > 0 ? Math.max(height, 3) : 3} rx="6" fill="var(--pri)" opacity={row.value > 0 ? 1 : 0.25} />
              <text x={x + bw / 2} y={base - Math.max(height, 3) - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink)">{row.text}</text>
              <text x={x + bw / 2} y={base + 20} textAnchor="middle" fontSize="12" fill="var(--mut)">{row.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// results: [{ ex, s (0 to 1 or null), t (seconds) }]. Repeated exercises are averaged.
function exerciseSummary(results, exercises = ALL_EXERCISES) {
  return exercises.map(exercise => {
    const matches = results.filter(result => result.ex === exercise);
    const scored = matches.filter(result => Number.isFinite(result.s));
    return {
      exercise,
      score: scored.length ? Math.round(100 * scored.reduce((total, result) => total + result.s, 0) / scored.length) : null,
      time: matches.length ? +(matches.reduce((total, result) => total + (result.t ?? 0), 0) / matches.length).toFixed(1) : 0,
      done: matches.length > 0,
    };
  });
}

export default function ScoreTimeCharts({ results, scoreTitle = 'Score for each exercise', timeTitle = 'Time in seconds for each exercise', exercises = ALL_EXERCISES }) {
  const rows = exerciseSummary(results, exercises);
  return (
    <>
      <BarChart title={scoreTitle} max={100} rows={rows.map(row => ({ label: shortName(row.exercise), value: row.score ?? 0, text: row.score == null ? (row.done ? 'n/a' : '0') : String(row.score) }))} />
      <BarChart title={timeTitle} rows={rows.map(row => ({ label: shortName(row.exercise), value: row.time, text: String(row.time) }))} />
    </>
  );
}
