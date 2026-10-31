/**
 * Zod validation schemas for every route that accepts a request body or significant params.
 *
 * Using `z.object(...).strict()` everywhere means Zod strips—or rejects—unknown keys
 * depending on the call-site (we use .parse() which throws on unknown fields with .strict()).
 */
import { z } from 'zod';

// ─── Shared primitives ─────────────────────────────────────────────────────────

const shortText = (max = 2000) =>
  z.string().trim().min(1).max(max);

const validId = z
  .string()
  .regex(/^[\w:-]{1,128}$/, 'Invalid identifier format');

const severity = z.enum(['low', 'medium', 'high']);

const role = z.enum(['patient', 'clinician']);

// ─── Auth routes ──────────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    role,
  })
  .strict();

export const invitationSchema = z
  .object({
    patientName: z.string().trim().min(1).max(100),
    email: z
      .string()
      .trim()
      .email()
      .max(254),
  })
  .strict();

export const linkSchema = z
  .object({
    code: z.string().regex(/^[\w-]{32}$/, 'Invalid invite code'),
    consent: z.boolean().optional(),
    clinicianUid: z.string().optional(),
  })
  .strict();

// ─── Analytics routes ─────────────────────────────────────────────────────────

const repSchema = z
  .object({
    peak: z.number().optional(),
    durationMs: z.number().positive().optional(),
    outboundMs: z.number().positive().optional(),
    returnMs: z.number().positive().optional(),
    peakDeg: z.number().optional(),
    withinTarget: z.boolean().optional(),
    score: z.number().min(0).max(100).optional(),
  })
  .passthrough(); // sensor data may include extra telemetry fields

const exerciseResultSchema = z
  .object({
    ex: z.string().min(1).max(100),
    reps: z.array(repSchema).max(200).optional(),
    t: z.number().nonnegative().optional(),
    s: z.number().min(0).max(1).optional(),
    attemptedReps: z.number().int().nonnegative().optional(),
    movementScore: z.number().min(0).max(100).optional(),
    targetExcursionDeg: z.number().positive().max(360).optional(),
    targetReps: z.number().int().positive().max(100).optional(),
    activeMs: z.number().nonnegative().optional(),
  })
  .passthrough();

const sessionSchema = z
  .object({
    r: z.array(exerciseResultSchema).max(20).optional(),
    exerciseResults: z.array(exerciseResultSchema).max(20).optional(),
    d: z.string().optional(),
    s: z.number().min(0).max(1).optional(),
    status: z.string().optional(),
    mode: z.string().optional(),
  })
  .passthrough();

const planItemSchema = z
  .object({
    ex: z.string().min(1).max(100),
    targetExcursionDeg: z.number().positive().max(360).optional(),
    targetReps: z.number().int().positive().max(100).optional(),
  })
  .passthrough();

const planSchema = z
  .object({
    items: z.array(planItemSchema).max(20).optional(),
  })
  .passthrough()
  .optional();

export const evaluateSessionSchema = z
  .object({
    session: sessionSchema,
    plan: planSchema,
  })
  .strict();

const patientSchema = z
  .object({
    n: z.string().max(200).optional(),
    displayName: z.string().max(200).optional(),
    id: z.string().max(128).optional(),
    patientUid: z.string().max(128).optional(),
    clinicianName: z.string().max(200).optional(),
  })
  .passthrough()
  .optional();

export const soapNoteSchema = z
  .object({
    patient: patientSchema,
    session: sessionSchema,
    plan: planSchema,
  })
  .strict();

// ─── Exercise reports ─────────────────────────────────────────────────────────

export const exerciseReportSchema = z
  .object({
    exercise: shortText(),
    reason: shortText(),
    patientId: validId.optional(),
    notes: z.string().max(2000).optional().default(''),
    severity: severity.optional().default('medium'),
  })
  .strict();

// ─── AI drafts ────────────────────────────────────────────────────────────────

export const aiDraftSchema = z
  .object({
    brief: shortText(3000),
    reference: shortText(3000),
    referenceNotes: shortText(3000),
    consent: z.literal(true, {
      errorMap: () => ({ message: 'You must consent to send these fields to Gemini.' }),
    }),
  })
  .strict();

export const aiDraftReviewSchema = z
  .object({
    status: z.enum(['reviewed', 'rejected']),
    note: shortText(3000),
  })
  .strict();

// ─── Knowledge chat ───────────────────────────────────────────────────────────

export const knowledgeChatSchema = z
  .object({
    message: shortText(3000),
    exerciseId: z.string().nullable().optional(),
    consent: z.literal(true, {
      errorMap: () => ({ message: 'You must consent to send the message and retrieved summaries to Gemini.' }),
    }),
  })
  .strict();

// ─── Records operations ───────────────────────────────────────────────────────

export const meetingSchema = z
  .object({
    patientId: validId.optional(),
    scheduledAt: z.string().datetime({ message: 'scheduledAt must be an ISO 8601 date-time' }),
    durationMin: z.number().int().min(1).max(480).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

// ─── Param schemas ────────────────────────────────────────────────────────────

/** Validates route params that contain a single :id */
export const idParamSchema = z.object({ id: validId });

export const patientOpParamSchema = z.object({
  patientId: validId,
  operation: z.string().min(1).max(64),
});

export const meetingIdParamSchema = z.object({ meetingId: validId });

// ─── Utility: parse or throw AppError ─────────────────────────────────────────

import { AppError } from '../middleware/errorHandler.js';

/**
 * Parse `data` against `schema`. Throws a 400 AppError with a human-readable
 * message when validation fails. Unknown fields on strict schemas are caught here.
 *
 * @template T
 * @param {import('zod').ZodSchema<T>} schema
 * @param {unknown} data
 * @returns {T}
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  // Zod uses `.issues` (not `.errors`) on the ZodError object
  const issues = result.error?.issues ?? result.error?.errors ?? [];
  const message = issues
    .map(e => `${Array.isArray(e.path) && e.path.length ? e.path.join('.') : 'body'}: ${e.message}`)
    .join('; ') || result.error?.message || 'Validation failed';
  throw new AppError(message, 400, 'VALIDATION_ERROR');
}
