import { angleAt, namedKeypoints, visible } from '../vision/geometry.js';

export const EXERCISE_DEFINITIONS = {
  squat: {
    id: 'squat',
    name: 'Squat or mini-squat',
    cameraView: 'side',
    measurementVersion: 'squat-side-v1',
    setup: 'Stand side-on with your shoulder, hip, knee, and ankle visible.',
  },
  armRaise: {
    id: 'arm-raise',
    name: 'Bilateral side arm raise',
    cameraView: 'front',
    measurementVersion: 'arm-raise-front-v1',
    setup: 'Face the camera with both shoulders, elbows, wrists, and hips visible.',
  },
};

export function squatKneeAngle(keypoints, side = 'left', minimumScore = 0.3) {
  const points = namedKeypoints(keypoints);
  const joints = [points[`${side}_hip`], points[`${side}_knee`], points[`${side}_ankle`]];
  return visible(joints, minimumScore) ? angleAt(...joints) : null;
}

export function armRaiseAngle(keypoints, side, minimumScore = 0.3) {
  const points = namedKeypoints(keypoints);
  const joints = [points[`${side}_hip`], points[`${side}_shoulder`], points[`${side}_elbow`]];
  return visible(joints, minimumScore) ? angleAt(...joints) : null;
}
