// Development-only visual fixture with synthetic data; excluded from the app build.
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../src/index.css';
import '../src/dark.css';
import '../src/mobile.css';
import { AuthContext } from '../src/auth/authContext';
import { RecordsContext } from '../src/records/recordsContext';
import ClientLayout from '../src/client/Layout';
import ClientOverview from '../src/client/Overview';
import { ClientLibrary } from '../src/client/LibrarySettings';
import ClientAssign from '../src/client/Assign';
import PatientLayout from '../src/patient/Layout';
import PatientHome from '../src/patient/Home';
import PatientWorkout from '../src/patient/Workout';
import PatientPlan from '../src/patient/Plan';
import PatientPre from '../src/patient/Pre';
import PatientLive from '../src/patient/Live';
import KnowledgeExerciseChat from '../src/client/KnowledgeExerciseChat';
import Toast from '../src/components/Toast';
import { buildSelfGuidedPlan } from '../src/patient/selfGuided';

const screens = ['/client/overview', '/patient/home', '/client/library', '/preview/generation', '/client/patients/preview/assign', '/patient/pre', '/patient/live'];
const screen = new URLSearchParams(location.search).get('screen');
const width = Math.min(800, Math.max(320, Number(new URLSearchParams(location.search).get('width')) || 390));
const plan = buildSelfGuidedPlan();
const records = { workspace: { patients: [{ id: 'preview', n: 'Preview Patient', email: 'patient@example.test', a: 'Test plan' }], references: [] }, backend: 'mongodb-atlas', sessions: () => [], requests: () => [], feedback: () => [], patientId: 'preview', patientPlan: () => plan, assignment: () => null, assignmentDraft: () => null, saveAssignmentDraft: async () => {}, publishAssignment: async () => {} };
const auth = { user: { uid: 'preview', displayName: 'Dipti Pathak', role: 'clinician' }, connectedEnabled: false, signOut: async () => {} };
const sampleGuide = { _id: 'fixture-guide', model: 'Synthetic visual fixture', createdAt: '2026-10-31T09:00:00Z', exercise: { exercise_id: 'EX-KU-000001', exercise_name: 'Bilateral mini-squat', movement_phases: [{ phase_id: 'lower', phase_name: 'Lower', description: 'Bend the knees through a comfortable shallow range.' }, { phase_id: 'return', phase_name: 'Return', description: 'Return to the starting position.' }] }, plan: { claims: [{ text: 'Synthetic preview content for layout testing. This is not an AI response or patient prescription.' }], questions: [], missing_requirements: ['Clinical review and individualized targets are pending.'] }, citations: [{ id: 'fixture-source', title: 'Synthetic source card for visual testing', chapter_number: 21, printed_page_numbers: [768], pdf_page_numbers: [801] }], preview: { id: 'mini-squat-illustration-v1', exercise_id: 'EX-KU-000001', knee_range_degrees: [30, 45] } };
const previewApi = async (path, body) => path.endsWith('/catalog') ? { exercises: [{ exercise_id: 'EX-KU-000001', exercise_name: 'Bilateral mini-squat' }] } : body ? sampleGuide : [];

createRoot(document.getElementById('root')).render(!screen ? <div style={{ display: 'flex', gap: 20, padding: 20, alignItems: 'start', overflowX: 'auto' }}>{screens.map(path => <div key={path}><p>{path}</p><iframe title={path} src={`?screen=${encodeURIComponent(path)}`} style={{ width, height: 844, border: '1px solid #ccc', borderRadius: 16 }} /></div>)}</div> : <AuthContext.Provider value={{ ...auth, connectedEnabled: screen === '/preview/generation' }}><RecordsContext.Provider value={records}><MemoryRouter initialEntries={[{ pathname: screen, state: { exIdx: 1 } }]}><Toast /><Routes><Route path="/preview/generation" element={<main className="main"><p className="session-status">Synthetic creation-workflow fixture. No Gemini request is sent.</p><KnowledgeExerciseChat api={previewApi} /></main>} /><Route path="/client" element={<ClientLayout />}><Route path="overview" element={<ClientOverview />} /><Route path="library" element={<ClientLibrary />} /><Route path="patients/:id/assign" element={<ClientAssign />} /></Route><Route path="/patient" element={<PatientLayout />}><Route path="home" element={<PatientHome />} /><Route path="workout" element={<PatientWorkout />} /><Route path="plan" element={<PatientPlan />} /><Route path="pre" element={<PatientPre />} /><Route path="live" element={<PatientLive />} /></Route></Routes></MemoryRouter></RecordsContext.Provider></AuthContext.Provider>);
