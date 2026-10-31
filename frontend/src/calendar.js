export function localDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function centeredDays(center = new Date()) {
  return Array.from({ length: 7 }, (_, index) => new Date(center.getFullYear(), center.getMonth(), center.getDate() + index - 3));
}

export function meetingsOnDay(meetings, day) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  return meetings.filter(meeting => meeting.status === 'scheduled' && Date.parse(meeting.startsAt) < end && Date.parse(meeting.endsAt) > start);
}
