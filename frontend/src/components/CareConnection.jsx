import { useEffect, useState } from 'react';
import { useAuth } from '../auth/authContext';
import { connectedApi } from '../services/atlasRecords';

export default function CareConnection() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [generated, setGenerated] = useState(null);
  const [preview, setPreview] = useState(null);
  const [relationship, setRelationship] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(user.role !== 'patient');
  useEffect(() => {
    if (user.role !== 'patient') return;
    let active = true;
    connectedApi('auth/relationship').then(data => { if (active) { setRelationship(data.relationship); setLoaded(true); } }).catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [user.uid, user.role]);
  const run = async action => { setBusy(true); setError(''); try { await action(); } catch (cause) { setError(cause.message); } finally { setBusy(false); } };
  const reload = async () => { const data = await connectedApi('auth/relationship'); setRelationship(data.relationship); setPreview(null); setConsent(false); window.dispatchEvent(new Event('kineticare-records-updated')); };
  return <section className="card"><h2>{user.role === 'clinician' ? 'Invite a patient' : 'Your clinician connection'}</h2>
    {user.role === 'clinician' ? <><p className="mut">Share a code with a patient. They will see your name and must explicitly consent before you can access their records. The code expires in 24 hours.</p><button className="btn" disabled={busy} onClick={() => run(async () => setGenerated(await connectedApi('auth/invite-code', {})))}>Create invite code</button>{generated && <><label htmlFor="care-code-generated">Share this code</label><input id="care-code-generated" value={generated.code} readOnly onFocus={event => event.target.select()} /><p className="mut">Expires {new Date(generated.expiresAt).toLocaleString()}</p></>}</> : !loaded ? <p>Loading connection…</p> : relationship ? <><p>Connected to <b>{relationship.clinicianName}</b></p><p className="mut">Sharing consent recorded {new Date(relationship.consentAt).toLocaleString()}. Your clinician can access your history and send plans and feedback.</p><button className="btn s" disabled={busy} onClick={() => run(async () => { await connectedApi('auth/revoke', {}); await reload(); })}>Revoke access</button></> : <><p className="mut">You can use the app independently. Connect only when you choose.</p><label htmlFor="care-code">Clinician invite code</label><input id="care-code" maxLength={32} value={code} onChange={event => { setCode(event.target.value.trim()); setPreview(null); setConsent(false); }} /><button className="btn s" disabled={busy || !code} onClick={() => run(async () => setPreview((await connectedApi('auth/link', { code })).clinician))}>Review clinician</button>{preview && <><h3>{preview.displayName}</h3><p className="mut">{preview.professionalVerified ? 'Credentials verified' : 'Self-registered clinician; credentials not verified by Kineticare.'}</p><label className="check-label"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />I consent to share my saved exercise sessions, progress and care messages with this clinician and receive their plans and feedback. I can revoke access at any time.</label><button className="btn" disabled={busy || !consent} onClick={() => run(async () => { await connectedApi('auth/link', { code, consent: true, clinicianUid: preview.uid }); await reload(); })}>Confirm connection</button></>}</>}
    {error && <p role="alert" className="demo">{error}</p>}
  </section>;
}
