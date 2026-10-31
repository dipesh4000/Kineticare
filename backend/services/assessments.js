import { z } from 'zod';
import { postureOptions, romFields, strengthFields, restrictions, painSites, functionalOptions, somatotypes } from '../../shared/assessmentFields.js';
import { AppError } from '../middleware/errorHandler.js';

const id = z.string().regex(/^[\w:-]{1,128}$/);
const bilateral = max => z.object({ left: z.number().min(0).max(max).optional(), right: z.number().min(0).max(max).optional() }).strict();
export const assessmentSchema = z.object({
  assessmentId: id,
  version: z.number().int().positive(),
  // A date-only assessment may already be tomorrow in UTC+14 relative to the server.
  assessedAt: z.string().date().refine(value => value <= new Date(Date.now() + 14 * 3600000).toISOString().slice(0, 10), 'Assessment date cannot be in the future.'),
  anthropometrics: z.object({ heightCm: z.number().min(30).max(250).optional(), weightKg: z.number().min(1).max(500).optional(), somatotype: z.enum(somatotypes).optional(), legLengthDiscrepancyCm: z.number().min(0).max(30).optional() }).strict().default({}),
  posture: z.object(Object.fromEntries(Object.entries(postureOptions).map(([key, options]) => [key, z.enum(options).optional()]))).strict().default({}),
  rom: z.object(Object.fromEntries(romFields.map(key => [key, bilateral(180).optional()]))).strict().default({}),
  strength: z.object(Object.fromEntries(strengthFields.map(key => [key, bilateral(5).refine(value => Object.values(value).every(Number.isInteger), 'Strength grades must be integers.').optional()]))).strict().default({}),
  painAreas: z.array(z.object({ site: z.enum(painSites), nrs: z.number().int().min(0).max(10) }).strict()).max(painSites.length).refine(values => new Set(values.map(item => item.site)).size === values.length, 'Pain sites must be unique.').default([]),
  restrictions: z.array(z.enum(restrictions)).max(restrictions.length).default([]),
  functionalTests: z.object({ singleLegSquat: z.enum(functionalOptions).optional(), overheadSquat: z.enum(functionalOptions).optional() }).strict().default({}),
  notes: z.string().trim().max(2000).default(''),
}).strict();

export function validateAssessment(body) {
  const parsed = assessmentSchema.safeParse(body);
  if (!parsed.success) throw new AppError(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '), 400);
  const result = parsed.data;
  const { heightCm, weightKg } = result.anthropometrics;
  if (heightCm && weightKg) result.anthropometrics.bmi = +(weightKg / (heightCm / 100) ** 2).toFixed(1);
  return result;
}

export const assessmentKey = (patientId, assessmentId, version) => `${patientId}:assessments:${assessmentId}-v${version}`;
export async function findAssessment(collection, patientId, assessmentId, version, clinicianUid) {
  if (!id.safeParse(assessmentId).success || !Number.isInteger(version) || version < 1) throw new AppError('Select a valid published assessment version.', 400);
  const record = await collection.findOne({ _id: assessmentKey(patientId, assessmentId, version) });
  if (!record || record.data.clinicianUid !== clinicianUid) throw new AppError('Assessment version is unavailable for this patient and clinician.', 403);
  return record.data;
}
