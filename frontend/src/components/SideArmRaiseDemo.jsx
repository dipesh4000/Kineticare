import { lazy, Suspense } from 'react';
const ExerciseAnimationPreview = lazy(() => import('./ExerciseAnimationPreview'));
const descriptor = { id: 'side-arm-raise-illustration-v1', exercise_id: 'arm-raise' };

export default function SideArmRaiseDemo({ target = 75, studio = false }) {
  const angle = Math.min(180, Math.max(1, Number(target) || 75));
  return <Suspense fallback={<div className="session-status" role="status">Loading 3D movement preview…</div>}><ExerciseAnimationPreview key={`${angle}-${studio}`} descriptor={descriptor} initialPeak={angle} compact={!studio} /></Suspense>;
}
