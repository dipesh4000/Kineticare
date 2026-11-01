import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Toast from './components/Toast';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';

import PatientLayout from './patient/Layout';
import PatientHome from './patient/Home';
import PatientPlan from './patient/Plan';
import PatientPre from './patient/Pre';
import PatientLive from './patient/Live';
import PatientWorkout from './patient/Workout';
import PatientSummary from './patient/Summary';
import PatientProgress from './patient/Progress';
import PatientFeedback from './patient/Feedback';
import PatientProfile from './patient/Profile';
import PatientAiPhysio from './patient/PatientAiPhysio';

import ClientLayout from './client/Layout';
import ClientOverview from './client/Overview';
import ClientPatients from './client/Patients';
import ClientPatientDetail from './client/PatientDetail';
import ClientAssign from './client/Assign';
import ClientAiCopilot from './client/ClientAiCopilot';
import { ClientLibrary, ClientSettings } from './client/LibrarySettings';
import { useAuth } from './auth/authContext';

function RoleRoute({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center"><div className="card">Loading account…</div></div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'patient' ? '/patient/home' : '/client/overview'} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/patient" element={<RoleRoute role="patient"><PatientLayout /></RoleRoute>}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<ErrorBoundary fallbackPath="/patient/home"><PatientHome /></ErrorBoundary>} />
          <Route path="workout" element={<ErrorBoundary fallbackPath="/patient/plan"><PatientWorkout /></ErrorBoundary>} />
          <Route path="plan" element={<ErrorBoundary fallbackPath="/patient/home"><PatientWorkout initialTab="plan" /></ErrorBoundary>} />
          <Route path="ai-physio" element={<ErrorBoundary fallbackPath="/patient/home"><PatientAiPhysio /></ErrorBoundary>} />
          <Route path="pre" element={<PatientPre />} />
          <Route path="live" element={<ErrorBoundary fallbackPath="/patient/plan"><PatientLive /></ErrorBoundary>} />
          <Route path="sum" element={<ErrorBoundary fallbackPath="/patient/home"><PatientSummary /></ErrorBoundary>} />
          <Route path="prog" element={<PatientProgress />} />
          <Route path="fb" element={<PatientFeedback />} />
          <Route path="me" element={<PatientProfile />} />
        </Route>

        <Route path="/client" element={<RoleRoute role="clinician"><ClientLayout /></RoleRoute>}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<ErrorBoundary fallbackPath="/client/overview"><ClientOverview /></ErrorBoundary>} />
          <Route path="patients" element={<ErrorBoundary fallbackPath="/client/overview"><ClientPatients /></ErrorBoundary>} />
          <Route path="patients/:id" element={<ClientPatientDetail />} />
          <Route path="patients/:id/assign" element={<ClientAssign />} />
          <Route path="library" element={<ClientLibrary />} />
          <Route path="ai-copilot" element={<ErrorBoundary fallbackPath="/client/overview"><ClientAiCopilot /></ErrorBoundary>} />
          <Route path="settings" element={<ClientSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
