import './MovementReport.css';

const number = value => Number.isFinite(value);
const tone = value => !number(value) ? 'unknown' : value < 50 ? 'low' : value < 75 ? 'mid' : 'high';
const score = result => number(result.movementScore) ? result.movementScore : number(result.s) ? result.s * 100 : null;
const display = value => number(value) ? Math.round(value) : '—';

function MovementFigure({ exercise }) {
  const squat = exercise === 'Squat';
  const bend = exercise === 'Toe Touch';
  return <svg className="movement-figure" viewBox="0 0 120 130" role="img" aria-label={`${exercise} illustrative movement diagram, not patient capture`}>
    <circle cx={squat ? 48 : bend ? 78 : 60} cy={squat ? 30 : bend ? 40 : 20} r="9" />
    <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <path d={squat ? 'M48 42 L60 68 L35 85 L60 115 M60 68 L82 86 L70 115 M51 48 L76 56 L96 53' : bend ? 'M72 49 L48 72 L46 112 M48 72 L65 113 M67 53 L86 79 L88 99' : 'M60 32 V75 M60 75 L43 115 M60 75 L77 115 M60 40 L35 30 L24 10 M60 40 L85 30 L96 10'} />
    </g>
    <path d={squat ? 'M25 59 Q10 85 33 103' : bend ? 'M81 29 Q107 48 103 74' : 'M14 48 Q17 25 30 15 M106 48 Q103 25 90 15'} fill="none" stroke="#f0747a" strokeWidth="2" strokeDasharray="3 3" />
    <path d="M18 120 H103" stroke="#dbe2e7" />
  </svg>;
}

function Metric({ label, value, detail }) {
  return <div className="movement-metric"><div><b>{label}</b><span>{detail}</span></div><div className="movement-track"><span className={tone(value)} style={{ width: `${number(value) ? Math.max(0, Math.min(100, value)) : 0}%` }} /></div></div>;
}

export default function MovementReport({ patient, session, plan }) {
  const results = session.r ?? session.exerciseResults ?? [];
  const scores = results.map(score).filter(number);
  const overall = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
  const replay = session.mode === 'replay';
  return <section className="movement-report" aria-label="Movement session report">
    <header className="movement-header">
      <div className={`movement-ring ${tone(overall)}`} style={{ '--score': `${number(overall) ? Math.max(0, Math.min(100, overall)) * 3.6 : 0}deg` }}><div><small>SCORE</small><strong>{display(overall)}</strong></div></div>
      <div className="movement-identity"><span className="movement-kicker">YOUR MOVEMENT, AT A GLANCE</span><h2>Movement Session Report</h2><p><b>Name:</b> {patient?.n ?? patient?.displayName ?? 'Patient'}</p><p><b>Report date:</b> {session.d ?? 'Not recorded'}</p></div>
      <img className="movement-logo" src="/logo-blue.png" alt="Kineticare" />
    </header>
    <div className="movement-context"><span>{replay ? 'REPLAY · SYNTHETIC DATA' : session.mode === 'live' ? 'CAMERA SESSION' : 'SESSION MODE NOT RECORDED'}</span><span>{session.reviewStatus === 'reviewed' ? 'Reviewed' : 'Awaiting review'} · {session.status ?? 'In progress'}</span></div>
    <p className="movement-caption">Prototype score from target reach and tempo. Colors group scores: 0–49 / 50–74 / 75–100; they are not clinical grades.</p>
    <div className="movement-results">{results.map((result, index) => {
      const reps = result.reps ?? [];
      const validPeaks = reps.map(rep => number(rep.peakDeg) ? rep.peakDeg : number(rep.peak) && number(result.targetExcursionDeg) ? rep.peak * result.targetExcursionDeg : null).filter(number);
      const meanPeak = validPeaks.length ? validPeaks.reduce((sum, value) => sum + value, 0) / validPeaks.length : null;
      const knownTargets = reps.filter(rep => typeof rep.withinTarget === 'boolean');
      const reach = knownTargets.length ? 100 * knownTargets.filter(rep => rep.withinTarget).length / knownTargets.length : null;
      const durations = reps.map(rep => rep.durationMs).filter(number);
      const tempo = durations.length ? 100 * durations.filter(ms => ms >= 2000 && ms <= 5000).length / durations.length : null;
      const value = score(result);
      return <article className="movement-card" key={`${result.ex}-${index}`}><h3>{result.ex}<small>{result.t == null ? 'Time not recorded' : `${result.t}s active`} · {result.assessedReps ?? (reps.length || '—')} reps assessed</small></h3><div className="movement-card-body"><div className="movement-illustration"><MovementFigure exercise={result.ex} /><small>Illustrative diagram</small></div><div className="movement-metrics"><Metric label="TARGET REACH" value={reach} detail={number(reach) ? `${display(reach)}% of recorded reps in target` : 'Not measured'} /><Metric label="TEMPO" value={tempo} detail={number(tempo) ? `${display(tempo)}% of recorded reps within 2–5s` : 'Not measured'} /><Metric label="MOVEMENT SCORE" value={value} detail={number(meanPeak) ? `Mean excursion ${display(meanPeak)}°${number(result.targetExcursionDeg) ? ` · target ${result.targetExcursionDeg}°` : ''}` : 'Excursion not recorded'} /></div><span className={`movement-score ${tone(value)}`}>{display(value)}<small>/100</small></span></div></article>;
    })}</div>
    {!results.length && <p className="movement-caption">Complete an exercise to see recorded results.</p>}
    <h3 className="movement-guidance-title">Guidance & next steps</h3><div className="movement-guidance">{[['PRACTICE', 'Review your exercise instructions and demonstration before your next session.'], ['REVIEW', plan?.source === 'self-guided' ? 'Starter template. No personalized clinical review is recorded.' : `Care plan: ${plan?.name ?? 'Not recorded'}. Follow the prescribed targets and rest schedule.`], ['OBSERVE', 'Camera scores describe the recorded movement. Symptoms and clinical assessment provide additional context.'], ['DISCUSS', 'Share questions or changes in symptoms with your treating professional.']].map(([title, text]) => <div key={title}><h4>{title}</h4><p>{text}</p></div>)}</div>
    <footer className="movement-report-footer">Kineticare · Confidential patient record · Diagrams illustrate movements; symmetry and diagnoses are not measured here.</footer>
  </section>;
}
