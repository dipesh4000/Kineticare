export default function CurrentWeek() {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (today.getDay() + 6) % 7);
  const days = Array.from({ length: 7 }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
  const format = date => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <section className="current-week" aria-label="Current week">
      <div className="week-heading"><span>This week</span><small>{format(days[0])} – {format(days[6])}</small></div>
      <div className="week-days">
        {days.map(date => <div key={date.toISOString()} className={date.toDateString() === today.toDateString() ? 'is-today' : ''} aria-current={date.toDateString() === today.toDateString() ? 'date' : undefined}>
          <small>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</small><span>{date.getDate()}</span>
        </div>)}
      </div>
    </section>
  );
}
