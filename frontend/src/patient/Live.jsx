import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DATA } from '../data';

function Skeleton({ paused }) {
  return (
    <svg viewBox="0 0 200 300" style={{ width: 160 }}>
      <g stroke="#b9b0ff" strokeWidth="5" strokeLinecap="round" fill="#b9b0ff">
        <circle cx="100" cy="55" r="18" />
        <path d="M100 75V170M100 170L75 250M100 170L125 250" />
        <g style={{ transformBox: 'fill-box', transformOrigin: 'top center', animation: paused ? 'none' : 'sw 1.6s ease-in-out infinite' }}>
          <path d="M100 95L60 150" /><circle cx="60" cy="150" r="5" />
        </g>
        <g style={{ transformBox: 'fill-box', transformOrigin: 'top center', animation: paused ? 'none' : 'sw 1.6s ease-in-out infinite', animationDirection: 'reverse' }}>
          <path d="M100 95L140 150" /><circle cx="140" cy="150" r="5" />
        </g>
      </g>
    </svg>
  );
}

export default function PatientLive() {
  const nav = useNavigate();
  const { state } = useLocation();
  const exIdx = state?.exIdx ?? 0;
  const DUR = 8;
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const [bad, setBad] = useState(false);
  const doneRef = useRef(state?.done || []);
  const P = DATA.plan;
  const x = P.items[exIdx];

  useEffect(() => {
    const id = setInterval(() => {
      if (paused || bad) return;
      setT(prev => {
        if (prev + 1 >= DUR) {
          clearInterval(id);
          const result = { ex: x.ex, t: DUR, s: +(.7 + Math.random() * .25).toFixed(2), c: 'Demo' };
          const newDone = [...doneRef.current, result];
          if (exIdx + 1 < P.items.length) {
            nav('/patient/live', { state: { exIdx: exIdx + 1, done: newDone } });
          } else {
            nav('/patient/sum', { state: { done: newDone } });
          }
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, bad]);

  return (
    <>
      <div className="row sp">
        <h2 style={{ margin: 0 }}>{x.ex}</h2>
        <span className="tag">{exIdx + 1} of {P.items.length}</span>
      </div>
      <div className="demo">Demo mode: sample data only.</div>
      <div className={`cam${paused || bad ? ' paused' : ''}`} aria-label="Simulated camera view">
        <span className={`tag ${bad ? 'warn' : 'ok'} st`}>{bad ? 'Poor lighting' : 'Body detected'}</span>
        <Skeleton paused={paused || bad} />
      </div>
      {bad && <div className="demo" role="alert" style={{ marginTop: 12 }}>Unable to assess. Adjust your position or lighting and retry.</div>}
      {!bad && <p className="mut">Exercise recognized: {x.ex}</p>}
      <div className="row sp">
        <b style={{ fontSize: 24 }}>{t}s</b>
        <span className="mut">of {DUR}s (demo length)</span>
      </div>
      <div className="prog"><b style={{ width: `${Math.min(100, t / DUR * 100)}%` }} /></div>
      <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
        <button className="btn s" onClick={() => setPaused(p => !p)}>{paused ? 'Resume' : 'Pause'}</button>
        <button className="btn s" onClick={() => setBad(b => !b)}>{bad ? 'Restore tracking' : 'Simulate poor lighting'}</button>
        <button className="btn d" onClick={() => { if (confirm('Stop this session?')) nav('/patient/plan'); }}>Stop</button>
      </div>
    </>
  );
}
