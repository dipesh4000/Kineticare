// Development-only visual fixture; this is not an authentication bypass or patient route.
import { createRoot } from 'react-dom/client';
import ExerciseAnimationPreview from '../src/components/ExerciseAnimationPreview';

createRoot(document.getElementById('root')).render(<ExerciseAnimationPreview descriptor={{ id: 'mini-squat-illustration-v1', exercise_id: 'EX-KU-000001', knee_range_degrees: [30, 45] }} />);
