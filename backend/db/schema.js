/**
 * Kineticare Database Schema (Drizzle ORM for Neon PostgreSQL)
 * Provides relational persistence for patients, clinicians, exercises, assignments, sessions, and clinical reports.
 */
import { pgTable, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // P-101 or C-001 or UUID
  email: text('email').notNull().unique(),
  role: text('role').notNull(), // 'patient' | 'clinician'
  displayName: text('display_name').notNull(),
  metadata: jsonb('metadata'), // age, gender, notes
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const relationships = pgTable('relationships', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').references(() => users.id).notNull(),
  clinicianId: text('clinician_id').references(() => users.id).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const exercises = pgTable('exercises', {
  id: text('id').primaryKey(), // 'squat', 'arm-raise', 'toe-touch'
  name: text('name').notNull(),
  category: text('category').notNull(),
  cameraView: text('camera_view').notNull(), // 'side' | 'front'
  primaryJoint: text('primary_joint').notNull(),
  normativeRange: jsonb('normative_range').notNull(), // [minDeg, maxDeg]
  instructions: jsonb('instructions').notNull(),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const assignments = pgTable('assignments', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').references(() => users.id).notNull(),
  clinicianId: text('clinician_id').references(() => users.id).notNull(),
  version: integer('version').default(1).notNull(),
  status: text('status').default('published').notNull(), // 'draft' | 'published'
  items: jsonb('items').notNull(), // array of exercise targets, reps, instructions
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').references(() => users.id).notNull(),
  assignmentId: text('assignment_id'),
  exerciseName: text('exercise_name').notNull(),
  repsCompleted: integer('reps_completed').default(0).notNull(),
  overallScore: integer('overall_score').default(0).notNull(),
  metrics: jsonb('metrics'), // ROM, tempo, fatigue index, eccentric ratio
  reviewStatus: text('review_status').default('pending'), // 'pending' | 'reviewed'
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

export const clinicalReports = pgTable('clinical_reports', {
  id: text('id').primaryKey(),
  exercise: text('exercise').notNull(),
  patientId: text('patient_id'),
  reportedBy: text('reported_by').notNull(),
  reason: text('reason').notNull(),
  severity: text('severity').default('medium').notNull(), // 'low' | 'medium' | 'high'
  notes: text('notes'),
  status: text('status').default('logged').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
