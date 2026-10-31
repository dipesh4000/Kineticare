import test from 'node:test';
import assert from 'node:assert/strict';
import { miniSquatPose, sideArmRaisePose, validateIllustrativeDescriptor } from '../src/exercise/illustrativeMotion.js';
import { angleAt } from '../src/vision/geometry.js';

const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

test('arm raise animation preserves arm lengths, planted feet, bilateral angles and full return', () => {
  const initial = sideArmRaisePose(0);
  for (const target of [30, 45, 75, 90, 120, 180]) {
    for (let time = 0; time < 6; time += 0.05) {
      const pose = sideArmRaisePose(time, 6, target);
      for (const side of ['left', 'right']) {
        const p = pose.points;
        assert.deepEqual(p[`${side}Ankle`], initial.points[`${side}Ankle`]);
        assert.ok(Math.abs(distance(p[`${side}Shoulder`], p[`${side}Elbow`]) - 0.29) < 1e-8);
        const xy = name => ({ x: p[name][0], y: p[name][1] });
        const angle = angleAt(xy(`${side}Hip`), xy(`${side}Shoulder`), xy(`${side}Elbow`));
        // The display hips are narrower than the shoulders; measure against a vertical torso axis.
        const shoulder = xy(`${side}Shoulder`);
        const abduction = angleAt({ x: shoulder.x, y: shoulder.y - 1 }, shoulder, xy(`${side}Elbow`));
        assert.ok(Number.isFinite(angle));
        assert.ok(Math.abs(abduction - pose.shoulderDegrees) < 1e-5);
      }
    }
    assert.equal(sideArmRaisePose(3, 6, target).shoulderDegrees, target);
    assert.deepEqual(sideArmRaisePose(6, 6, target).points, initial.points);
  }
  for (const args of [[0, 6, 181], [0, 6, 0], [0, 2, 75], [NaN, 6, 75]]) assert.throws(() => sideArmRaisePose(...args));
});
test('illustrative squat preserves planted feet, segment lengths and requested knee angle', () => {
  const initial = miniSquatPose(0, 6, 45);
  for (let time = 0; time <= 6; time += 0.1) {
    const pose = miniSquatPose(time, 6, 45);
    for (const side of ['left', 'right']) {
      const p = pose.points;
      assert.deepEqual(p[`${side}Ankle`], initial.points[`${side}Ankle`]);
      assert.deepEqual(p[`${side}Toe`], initial.points[`${side}Toe`]);
      assert.ok(Math.abs(distance(p[`${side}Hip`], p[`${side}Knee`]) - 0.48) < 1e-10);
      assert.ok(Math.abs(distance(p[`${side}Ankle`], p[`${side}Knee`]) - 0.48) < 1e-10);
      const h = p[`${side}Hip`], k = p[`${side}Knee`], a = p[`${side}Ankle`];
      const u = h.map((v, i) => v - k[i]), v = a.map((value, i) => value - k[i]);
      const internal = Math.acos(Math.max(-1, Math.min(1, u.reduce((sum, value, i) => sum + value * v[i], 0) / 0.48 ** 2)));
      assert.ok(Math.abs(180 - internal * 180 / Math.PI - pose.kneeFlexionDegrees) < 1e-5);
    }
    assert.ok(Object.values(pose.points).flat().every(Number.isFinite));
  }
  assert.ok(Math.abs(miniSquatPose(3, 6, 45).kneeFlexionDegrees - 45) < 1e-10);
  assert.deepEqual(miniSquatPose(6, 6, 45).points, initial.points);
});

test('unsupported angles, timing and unregistered preview descriptors fail explicitly', () => {
  for (const args of [[0, 6, 90], [0, 0, 30], [NaN, 6, 30], [0, 6, 29]]) assert.throws(() => miniSquatPose(...args));
  assert.equal(validateIllustrativeDescriptor({ id: 'invented', exercise_id: 'EX-KU-000001', knee_range_degrees: [30, 45] }), false);
  assert.equal(validateIllustrativeDescriptor({ id: 'mini-squat-illustration-v1', exercise_id: 'EX-KU-000001', knee_range_degrees: [30, 45] }), true);
});
