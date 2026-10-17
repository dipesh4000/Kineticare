import { EXERCISES } from '../data';

export function ClientLibrary() {
  return (
    <>
      <h1>Exercise library</h1>
      <p className="mut">The 9 classes recognized by the prototype. Recognized does not mean clinically approved.</p>
      <div className="grid">
        {EXERCISES.map(x => (
          <div key={x} className="card">
            <h3>{x}</h3>
            <span className="tag">Recognized by prototype</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function ClientSettings() {
  return (
    <>
      <h1>Settings</h1>
      <div className="card">
        <b>Dr. Sarah Khan</b>
        <p className="mut">Physiotherapist · Demo workspace</p>
      </div>
    </>
  );
}
