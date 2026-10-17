import { avg } from './metrics';

export function Ring({ pct, label }) {
  const r = 42, circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" width={96} height={96} role="img" aria-label={`${label} ${pct}%`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--pri2)" strokeWidth="12" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--pri)" strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(circ * pct) / 100} ${circ}`}
        transform="rotate(-90 50 50)" />
      <text x="50" y="56" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor">{pct}%</text>
    </svg>
  );
}

export function LineChart({ vals, labs }) {
  if (!vals.length) return <p className="mut">No compatible scored sessions yet.</p>;
  const W = 300, H = 130, L = 26, R = 22, n = vals.length;
  const x = i => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1));
  const y = v => 10 + (H - 30) * (1 - v);
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 520, display: 'block' }} role="img" aria-label="Score trend">
      {[0, 0.5, 1].map(g => (
        <g key={g}>
          <line x1={L} x2={W - R + 8} y1={y(g)} y2={y(g)} stroke="#8883" />
          <text x="0" y={y(g) + 4} fontSize="10" fill="var(--mut)">{Math.round(g * 100)}</text>
        </g>
      ))}
      <polygon points={`${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`} fill="var(--pri2)" opacity=".7" />
      <polyline points={pts} fill="none" stroke="var(--pri)" strokeWidth="3" strokeLinejoin="round" />
      {vals.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="4.5" fill="var(--pri)" />
          <text x={x(i)} y={H - 4} fontSize="10" textAnchor="middle" fill="var(--mut)">{labs[i]}</text>
        </g>
      ))}
    </svg>
  );
}

export function HBar({ rows }) {
  return (
    <div>
      {rows.map(([label, pct, val]) => (
        <div key={label} style={{ margin: '10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{label}</span><b>{val}</b>
          </div>
          <div className="prog"><b style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function KPIs({ ss }) {
  if (!ss.length) return <div className="card">No saved sessions yet.</div>;
  const sc = ss.map(s => avg(s.r));
  const validScores = sc.filter(Number.isFinite);
  const d = validScores.length > 1 ? +(validScores.at(-1) - validScores[0]).toFixed(2) : null;
  const tm = Math.round(ss.reduce((a, s) => a + s.r.reduce((b, x) => b + x.t, 0), 0) / 60);
  return (
    <div className="card st4">
      <div><b>{ss.length}</b>Sessions</div>
      <div><b>{avg(ss.flatMap(s => s.r)) == null ? '—' : Math.round(avg(ss.flatMap(s => s.r)) * 100)}</b>Average score</div>
      <div><b>{tm} min</b>Total time</div>
      <div><b>{d == null ? '—' : `${d >= 0 ? '+' : ''}${Math.round(d * 100)}`}</b>Score change</div>
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="demo">
      Demo mode: sample data only. Scores are simulated and are not real patient measurements. Prototype, not clinically validated.
    </div>
  );
}
