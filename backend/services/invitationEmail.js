import '../config/environment.js';

export async function sendInvitationEmail({ email, patientName, clinicianName, code }) {
  if (!process.env.RESEND_API_KEY || !process.env.INVITATION_FROM_EMAIL || !process.env.APP_URL) {
    throw Object.assign(new Error('Invitation email is not configured. Set RESEND_API_KEY, INVITATION_FROM_EMAIL and APP_URL on the server.'), { status: 503 });
  }
  const url = new URL('/', process.env.APP_URL);
  if (!['http:', 'https:'].includes(url.protocol)) throw Object.assign(new Error('APP_URL must be an HTTP or HTTPS address.'), { status: 503 });
  url.searchParams.set('invite', code);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.INVITATION_FROM_EMAIL,
      to: [email],
      subject: 'Your Kineticare invitation',
      text: `Hi ${patientName},\n\n${clinicianName} has invited you to Kineticare. Sign in or create a Patient account using ${email}, then review your clinician and choose whether to share your records.\n\n${url.href}\n\nYour invite code: ${code}\nThis invitation expires in 24 hours. No records are shared until you consent. If you were not expecting this invitation, you can ignore it.`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Object.assign(new Error('The email provider could not send the invitation. Please try again.'), { status: 502 });
}
