import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSelfGuidedPlan, isSelfGuidedPlan } from '../src/patient/selfGuided.js';

test('self-guided template is clearly marked as requiring clinical review', () => {
  const plan = buildSelfGuidedPlan();
  assert.equal(isSelfGuidedPlan(plan), true);
  assert.equal(plan.requiresClinicianReview, true);
  assert.equal(plan.items.length, 3);
  assert.deepEqual(plan.items.map(item => item.targetExcursionDeg), [30, 45, 30]);
  assert.ok(plan.items.every(item => item.targetReps === 5));
});
