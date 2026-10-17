export const avg = r => +(r.reduce((a, x) => a + x.s, 0) / r.length).toFixed(2);

export const exs = ss => {
  const m = {};
  ss.forEach(s => s.r.forEach(x => { (m[x.ex] = m[x.ex] || []).push(x); }));
  return Object.entries(m).map(([k, a]) => [
    k,
    a.reduce((t, x) => t + x.s, 0) / a.length,
    a.reduce((t, x) => t + x.t, 0) / a.length,
  ]);
};

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
  const W = 300, H = 130, L = 26, n = vals.length;
  const x = i => L + (W - L - 10) * (n === 1 ? 0.5 : i / (n - 1));
  const y = v => 10 + (H - 30) * (1 - v);
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} role="img" aria-label="Score trend">
      {[0, 0.5, 1].map(g => (
        <g key={g}>
          <line x1={L} x2={W - 10} y1={y(g)} y2={y(g)} stroke="#8883" />
          <text x="0" y={y(g) + 4} fontSize="10" fill="var(--mut)">{g}</text>
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
          <div className="prog"><b style={{ width: `${pct}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function KPIs({ ss }) {
  const sc = ss.map(s => avg(s.r));
  const d = +(sc.at(-1) - sc[0]).toFixed(2);
  const tm = Math.round(ss.reduce((a, s) => a + s.r.reduce((b, x) => b + x.t, 0), 0) / 60);
  return (
    <div className="card st4">
      <div><b>{ss.length}</b>Sessions</div>
      <div><b>{avg(ss.flatMap(s => s.r))}</b>Average score</div>
      <div><b>{tm} min</b>Total time</div>
      <div><b>{d >= 0 ? '+' : ''}{d}</b>Score change</div>
    </div>
  );
}

export const DEMO_BANNER = (
  <div className="demo">
    Demo mode: sample data only. Scores are simulated and are not real patient measurements. Prototype, not clinically validated.
  </div>
);
