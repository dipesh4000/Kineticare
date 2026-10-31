import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { atlasDb } from '../services/atlas.js';
import { privyClient, requireProfile, requirePrivy } from '../services/identity.js';
import { sendInvitationEmail } from '../services/invitationEmail.js';

const hash = code => createHash('sha256').update(code).digest('hex');
export function createAuthRouter({ database = atlasDb, authenticate = requirePrivy, authenticatedProfile = requireProfile, getUser = id => privyClient().users()._get(id), sendInvite = sendInvitationEmail } = {}) {
  const router = express.Router();
  router.use(authenticate);
  router.get('/me', async (req, res) => {
    const profile = await (await database()).collection('users').findOne({ _id: req.privyId });
    res.json({ user: profile ? { ...profile, uid: profile._id } : null });
  });
  router.post('/register', async (req, res) => {
    const { displayName, role } = req.body ?? {};
    if (typeof displayName !== 'string' || !displayName.trim() || displayName.length > 100 || !['patient', 'clinician'].includes(role)) return res.status(400).json({ error: 'Enter your name and choose Patient or Clinician.' });
    const account = await getUser(req.privyId);
    const email = account.linked_accounts?.find(item => item.type === 'email')?.address;
    if (!email) return res.status(403).json({ error: 'Sign in with a verified email address.' });
    const users = (await database()).collection('users');
    await users.updateOne({ _id: req.privyId }, { $setOnInsert: { email, displayName: displayName.trim(), role, professionalVerified: false, createdAt: new Date().toISOString() } }, { upsert: true });
    const profile = await users.findOne({ _id: req.privyId });
    res.json({ user: { ...profile, uid: profile._id } });
  });
  router.use(authenticatedProfile);
  router.get('/relationship', async (req, res) => {
    if (req.identity.role !== 'patient') return res.status(403).json({ error: 'Patient account required.' });
    const db = await database();
    const relationship = await db.collection('relationships').findOne({ _id: req.identity.uid, active: true });
    const clinician = relationship ? await db.collection('users').findOne({ _id: relationship.clinicianUid }) : null;
    res.json({ relationship: relationship ? { ...relationship, clinicianName: clinician?.displayName, professionalVerified: clinician?.professionalVerified === true } : null });
  });
  router.post('/invite-code', async (req, res) => {
    if (req.identity.role !== 'clinician') return res.status(403).json({ error: 'Clinician account required.' });
    const code = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 86400000);
    await (await database()).collection('careInvites').insertOne({ _id: hash(code), clinicianUid: req.identity.uid, expiresAt, createdAt: new Date() });
    res.json({ code, expiresAt });
  });
  router.get('/invitations', async (req, res) => {
    if (req.identity.role !== 'clinician') return res.status(403).json({ error: 'Clinician account required.' });
    const invites = await (await database()).collection('careInvites').find({ clinicianUid: req.identity.uid }).toArray();
    res.json({ invitations: invites.filter(invite => invite.email).map(invite => ({
      id: invite._id, patientName: invite.patientName, email: invite.email, expiresAt: invite.expiresAt,
      status: invite.acceptedAt ? 'accepted' : invite.deliveryStatus === 'failed' ? 'failed' : invite.expiresAt <= new Date() ? 'expired' : invite.deliveryStatus === 'sent' ? 'pending' : 'sending',
    })).reverse() });
  });
  router.post('/invitations', async (req, res) => {
    if (req.identity.role !== 'clinician') return res.status(403).json({ error: 'Clinician account required.' });
    const { patientName, email } = req.body ?? {};
    if (typeof patientName !== 'string' || !patientName.trim() || patientName.length > 100 || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ error: 'Enter the patient’s name and a valid email address.' });
    const invites = (await database()).collection('careInvites');
    const code = randomBytes(24).toString('base64url');
    const invite = { _id: hash(code), clinicianUid: req.identity.uid, patientName: patientName.trim(), email: email.trim().toLowerCase(), expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(), deliveryStatus: 'sending' };
    await invites.insertOne(invite);
    try {
      await sendInvite({ email: invite.email, patientName: invite.patientName, clinicianName: req.identity.displayName, code });
    } catch (error) {
      await invites.updateOne({ _id: invite._id }, { $set: { deliveryStatus: 'failed' } });
      throw error;
    }
    await invites.updateOne({ _id: invite._id }, { $set: { deliveryStatus: 'sent' } });
    res.status(201).json({ success: true });
  });
  router.post('/link', async (req, res) => {
    if (req.identity.role !== 'patient') return res.status(403).json({ error: 'Patient account required.' });
    const { code, consent } = req.body ?? {};
    if (typeof code !== 'string' || !/^[\w-]{32}$/.test(code)) return res.status(400).json({ error: 'Enter a valid invite code.' });
    const db = await database();
    const invite = await db.collection('careInvites').findOne({ _id: hash(code), expiresAt: { $gt: new Date() } });
    if (invite?.email && (invite.deliveryStatus !== 'sent' || invite.acceptedAt)) return res.status(404).json({ error: 'Invite is invalid, already accepted or unavailable.' });
    if (invite?.email && invite.email !== req.identity.email?.toLowerCase()) return res.status(403).json({ error: 'Sign in with the email address this invitation was sent to.' });
    const clinician = invite ? await db.collection('users').findOne({ _id: invite.clinicianUid, role: 'clinician' }) : null;
    if (!clinician) return res.status(404).json({ error: 'Invite is invalid or expired.' });
    if (consent !== true) return res.json({ clinician: { uid: clinician._id, displayName: clinician.displayName, professionalVerified: clinician.professionalVerified === true } });
    if (req.body.clinicianUid !== clinician._id) return res.status(409).json({ error: 'Review the clinician before confirming consent.' });
    const relationship = { clinicianUid: clinician._id, active: true, consentVersion: 'care-sharing-v1', consentAt: new Date().toISOString() };
    try { await db.collection('relationships').updateOne({ _id: req.identity.uid, active: { $ne: true } }, { $set: relationship }, { upsert: true }); }
    catch (error) { if (error.code === 11000) return res.status(409).json({ error: 'Revoke your current connection before linking another clinician.' }); throw error; }
    if (invite.email) await db.collection('careInvites').updateOne({ _id: invite._id }, { $set: { acceptedAt: relationship.consentAt } });
    res.json({ success: true });
  });
  router.post('/revoke', async (req, res) => {
    if (req.identity.role !== 'patient') return res.status(403).json({ error: 'Patient account required.' });
    await (await database()).collection('relationships').updateOne({ _id: req.identity.uid, active: true }, { $set: { active: false, revokedAt: new Date().toISOString() } });
    res.json({ success: true });
  });
  return router;
}
export const authRouter = createAuthRouter();
