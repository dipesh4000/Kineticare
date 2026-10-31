export function validateMeeting(body, now = Date.now()) {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Enter meeting details.');
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 120) fail('Enter a meeting title of at most 120 characters.');
  if (typeof body.startsAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.startsAt)) fail('Choose a valid meeting date and time.');
  const start = Date.parse(body.startsAt);
  if (!Number.isFinite(start) || start <= now) fail('Choose a future meeting date and time.');
  if (!Number.isInteger(body.durationMinutes) || body.durationMinutes < 5 || body.durationMinutes > 240) fail('Meeting duration must be between 5 and 240 minutes.');
  const patientId = body.patientId || null;
  if (patientId !== null && (typeof patientId !== 'string' || !/^[\w:-]{1,128}$/.test(patientId))) fail('Choose a linked patient.');
  let url = '';
  if (body.url) {
    try { const parsed = new URL(body.url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.href.length > 2000) fail('Use an HTTPS meeting link without embedded credentials.'); url = parsed.href; }
    catch { fail('Use a valid HTTPS meeting link.'); }
  }
  return { title, patientId, startsAt: new Date(start).toISOString(), endsAt: new Date(start + body.durationMinutes * 60000).toISOString(), durationMinutes: body.durationMinutes, url };
}
