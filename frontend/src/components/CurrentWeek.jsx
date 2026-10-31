import { useState } from 'react';
import { centeredDays, localDayKey, meetingsOnDay } from '../calendar';

export default function CurrentWeek({ meetings = [], selectedDate, onSelect }) {
  const [offset, setOffset] = useState(0);
  const today = new Date();
  const days = centeredDays(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
  const format = date => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <section className="current-week" aria-label="Seven-day calendar">
      <div className="week-heading"><span>{offset ? 'Calendar' : 'Around today'}</span><div className="calendar-controls"><button type="button" aria-label="Previous seven days" onClick={() => { setOffset(value => value - 7); onSelect?.(null); }}>‹</button><button type="button" onClick={() => { setOffset(0); onSelect?.(null); }}>Today</button><button type="button" aria-label="Next seven days" onClick={() => { setOffset(value => value + 7); onSelect?.(null); }}>›</button></div></div>
      <p className="calendar-range">{format(days[0])} – {format(days[6])}</p>
      <div className="week-days">
        {days.map(date => {
          const isToday = localDayKey(date) === localDayKey(today);
          const count = meetingsOnDay(meetings, date).length;
          return <button type="button" key={localDayKey(date)} className={`${isToday ? 'is-today' : ''}${selectedDate === localDayKey(date) ? ' is-selected' : ''}`} aria-current={isToday ? 'date' : undefined} aria-pressed={selectedDate === localDayKey(date)} aria-label={`${date.toLocaleDateString(undefined, { dateStyle: 'full' })}${isToday ? ', today' : ''}, ${count} meetings`} onClick={() => onSelect?.(date)}><small>{date.toLocaleDateString(undefined, { weekday: 'short' })}</small><span>{date.getDate()}</span><i className={count ? 'calendar-event-dot' : 'calendar-no-event'} aria-hidden="true" /></button>;
        })}
      </div>
    </section>
  );
}
