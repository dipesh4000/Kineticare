/**
 * test/securityRules.test.js
 *
 * Security rules verification suite for Firestore and Cloud Storage.
 *
 * Validates rule logic, default-deny boundaries, role separation,
 * size/type limits, and clinical consent requirements.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const firestoreRulesPath = path.join(ROOT_DIR, 'firestore.rules');
const storageRulesPath = path.join(ROOT_DIR, 'storage.rules');

test('security rules: rule files exist and have valid headers', () => {
  assert.ok(fs.existsSync(firestoreRulesPath), 'firestore.rules must exist');
  assert.ok(fs.existsSync(storageRulesPath), 'storage.rules must exist');

  const firestoreRules = fs.readFileSync(firestoreRulesPath, 'utf-8');
  assert.ok(firestoreRules.includes("rules_version = '2';"), 'firestore.rules must specify rules_version = 2');
  assert.ok(firestoreRules.includes('service cloud.firestore'), 'firestore.rules must target service cloud.firestore');

  const storageRules = fs.readFileSync(storageRulesPath, 'utf-8');
  assert.ok(storageRules.includes("rules_version = '2';"), 'storage.rules must specify rules_version = 2');
  assert.ok(storageRules.includes('service firebase.storage'), 'storage.rules must target service firebase.storage');
});

test('firestore.rules: enforces deny-by-default', () => {
  const content = fs.readFileSync(firestoreRulesPath, 'utf-8');
  assert.ok(
    content.includes('match /{document=**}') && content.includes('allow read, write: if false;'),
    'firestore.rules must contain a top-level default-deny match rule',
  );
});

test('firestore.rules: prevents user role tampering and privilege escalation', () => {
  const content = fs.readFileSync(firestoreRulesPath, 'utf-8');
  assert.ok(content.includes('match /users/{userId}'), 'users collection rule must be defined');
  // Must check that role on update matches existing resource role
  assert.ok(
    content.includes('request.resource.data.role == resource.data.role'),
    'firestore.rules must prevent modifying user role on profile update',
  );
  assert.ok(
    content.includes('request.resource.data.professionalVerified == resource.data.professionalVerified'),
    'firestore.rules must prevent self-verifying professional credential status',
  );
});

test('firestore.rules: enforces relationship consent for clinician record access', () => {
  const content = fs.readFileSync(firestoreRulesPath, 'utf-8');
  assert.ok(content.includes('match /patientRecords/{recordId}'), 'patientRecords match must be defined');
  assert.ok(
    content.includes('patientHasConsented') || content.includes('relationships'),
    'patientRecords must require verified active relationship for clinician access',
  );
  assert.ok(
    content.includes('resource.data.patientId == request.auth.uid'),
    'patient must be permitted to read their own records',
  );
});

test('storage.rules: enforces deny-by-default and bans patient workout video storage', () => {
  const content = fs.readFileSync(storageRulesPath, 'utf-8');
  assert.ok(
    content.includes('match /{allPaths=**}') && content.includes('allow read, write: if false;'),
    'storage.rules must contain default deny rule',
  );
  // Workout video uploads must be banned (patient camera inference remains strictly local)
  assert.ok(
    content.includes('match /patient-recordings/{allPaths=**}') || content.includes('match /workouts/{allPaths=**}'),
    'storage.rules must explicitly guard against patient workout video upload',
  );
});

test('storage.rules: restricts reference uploads to clinicians, video mime types, and size ceiling', () => {
  const content = fs.readFileSync(storageRulesPath, 'utf-8');
  assert.ok(content.includes('match /references/{referenceId}/{versionId}/{fileName}'), 'reference videos path must be defined');
  assert.ok(content.includes('isClinician'), 'only clinicians may write reference video objects');
  assert.ok(
    content.includes('request.resource.size < 50 * 1024 * 1024') || content.includes('52428800'),
    'storage.rules must enforce max 50MB file size ceiling',
  );
  assert.ok(
    content.includes('video/mp4') && content.includes('video/webm'),
    'storage.rules must whitelist only video/mp4 and video/webm MIME types',
  );
});
