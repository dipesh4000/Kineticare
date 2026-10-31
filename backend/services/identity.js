/**
 * Identity / authentication service.
 *
 * Uses Privy as the token authority (verifyAccessToken) and MongoDB for the
 * application-level profile (role, displayName, …).
 *
 * All auth failures now throw/respond with the standard {code, message, requestId}
 * envelope by delegating to the central error handler via next(AppError).
 */
import '../config/environment.js';
import { PrivyClient } from '@privy-io/node';
import { atlasDb } from './atlas.js';
import { AppError } from '../middleware/errorHandler.js';

let client;

export function privyClient() {
  if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
    throw new AppError('Configure Privy on the backend.', 503, 'PRIVY_NOT_CONFIGURED');
  }
  return client ??= new PrivyClient({
    appId: process.env.PRIVY_APP_ID,
    appSecret: process.env.PRIVY_APP_SECRET,
  });
}

/** @type {import('express').RequestHandler} */
export async function requirePrivy(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) {
    return next(new AppError('Sign in to access connected records.', 401, 'UNAUTHORIZED'));
  }
  try {
    const verified = await privyClient().utils().auth().verifyAccessToken(token);
    req.privyId = verified.user_id;
    if (!req.privyId) throw new Error('Missing subject');
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    const is503 = error.status === 503;
    next(
      new AppError(
        is503 ? error.message : 'Your session could not be verified. Sign in again.',
        is503 ? 503 : 401,
        is503 ? 'PRIVY_NOT_CONFIGURED' : 'INVALID_TOKEN',
      ),
    );
  }
}

/** @type {import('express').RequestHandler} */
export async function requireProfile(req, res, next) {
  try {
    const profile = await (await atlasDb()).collection('users').findOne({ _id: req.privyId });
    if (!profile || !['patient', 'clinician'].includes(profile.role)) {
      return next(new AppError('Complete your account profile first.', 403, 'PROFILE_INCOMPLETE'));
    }
    req.identity = { ...profile, uid: profile._id };
    next();
  } catch (error) {
    next(error);
  }
}

export const requireIdentity = [requirePrivy, requireProfile];

/**
 * Returns true when `identity` is permitted to access `patientId`.
 * A patient can only access themselves; a clinician must have an active relationship.
 */
export async function canAccessPatient(identity, patientId, database = atlasDb) {
  if (identity.role === 'patient') return identity.uid === patientId;
  if (identity.role !== 'clinician') return false;
  return Boolean(
    await (await database()).collection('relationships').findOne({
      _id: patientId,
      clinicianUid: identity.uid,
      active: true,
    }),
  );
}
