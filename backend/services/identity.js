import '../config/environment.js';
import { PrivyClient } from '@privy-io/node';
import { atlasDb } from './atlas.js';
let client;
export function privyClient() {
  if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) throw Object.assign(new Error('Configure Privy on the backend.'), { status: 503 });
  return client ??= new PrivyClient({ appId: process.env.PRIVY_APP_ID, appSecret: process.env.PRIVY_APP_SECRET });
}
export async function requirePrivy(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return res.status(401).json({ error: 'Sign in to access connected records.' });
  try {
    const verified = await privyClient().utils().auth().verifyAccessToken(token);
    req.privyId = verified.user_id;
    if (!req.privyId) throw new Error('Missing subject');
    next();
  } catch (error) { res.status(error.status === 503 ? 503 : 401).json({ error: error.status === 503 ? error.message : 'Your session could not be verified. Sign in again.' }); }
}
export async function requireProfile(req, res, next) {
  try {
    const profile = await (await atlasDb()).collection('users').findOne({ _id: req.privyId });
    if (!profile || !['patient', 'clinician'].includes(profile.role)) return res.status(403).json({ error: 'Complete your account profile first.' });
    req.identity = { ...profile, uid: profile._id };
    next();
  } catch (error) { next(error); }
}
export const requireIdentity = [requirePrivy, requireProfile];
export async function canAccessPatient(identity, patientId, database = atlasDb) {
  if (identity.role === 'patient') return identity.uid === patientId;
  if (identity.role !== 'clinician') return false;
  return Boolean(await (await database()).collection('relationships').findOne({ _id: patientId, clinicianUid: identity.uid, active: true }));
}
