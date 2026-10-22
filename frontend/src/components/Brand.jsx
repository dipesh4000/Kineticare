export default function Brand({ subtitle = 'Move better. Feel better.' }) {
  return (
    <div className="brand-lockup">
      <span className="brand-mark"><img src="/logo-blue.png" alt="" /></span>
      <span><strong>Kineticare<span className="brand-dot">.</span></strong><small>{subtitle}</small></span>
    </div>
  );
}
