export default function WeeklyActivity({ sessions, compact = false }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
    const count = sessions.filter(session => {
      const performed = new Date(session.createdAt ?? session.d);
      return session.mode === 'live' && session.status === 'completed' && performed.toDateString() === date.toDateString();
    }).length;
    return { date, count };
  });
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const max = Math.max(1, ...days.map(day => day.count));
  return (
    <section className={`activity-module ${compact ? 'compact' : ''}`} aria-label="Completed live sessions over the last seven days">
      <div className="section-label"><span>Last 7 days</span><span className="tag">Live sessions</span></div>
      <div className="activity-total">{total}<span>completed sessions</span></div>
      <div className="activity-bars">
        {days.map(({ date, count }, index) => <div className={index === 6 ? 'today' : ''} key={date.toISOString()} aria-label={`${date.toLocaleDateString()}: ${count} completed sessions`}>
          <div className="bar-track"><span style={{ height: `${count / max * 100}%` }} /></div>
          <small>{date.toLocaleDateString('en', { weekday: 'narrow' })}</small>
        </div>)}
      </div>
      {!total && <p className="mut">Your next completed session will appear here.</p>}
    </section>
  );
}
