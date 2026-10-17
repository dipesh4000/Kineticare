import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useToast, Toast } from './components/Toast';
import Login from './components/Login';

import PatientLayout from './patient/Layout';
import PatientHome from './patient/Home';
import PatientPlan from './patient/Plan';
import PatientPre from './patient/Pre';
import PatientLive from './patient/Live';
import PatientSummary from './patient/Summary';
import PatientProgress from './patient/Progress';
import PatientFeedback from './patient/Feedback';
import PatientProfile from './patient/Profile';

import ClientLayout from './client/Layout';
import ClientOverview from './client/Overview';
import ClientPatients from './client/Patients';
import ClientPatientDetail from './client/PatientDetail';
import ClientAssign from './client/Assign';
import ClientSendFeedback from './client/SendFeedback';
import { ClientLibrary, ClientSettings } from './client/LibrarySettings';

function ToastProvider() {
  const msg = useToast();
  return <Toast msg={msg} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider />
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/patient" element={<PatientLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<PatientHome />} />
          <Route path="plan" element={<PatientPlan />} />
          <Route path="pre" element={<PatientPre />} />
          <Route path="live" element={<PatientLive />} />
          <Route path="sum" element={<PatientSummary />} />
          <Route path="prog" element={<PatientProgress />} />
          <Route path="fb" element={<PatientFeedback />} />
          <Route path="me" element={<PatientProfile />} />
        </Route>

        <Route path="/client" element={<ClientLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<ClientOverview />} />
          <Route path="patients" element={<ClientPatients />} />
          <Route path="patients/:id" element={<ClientPatientDetail />} />
          <Route path="patients/:id/assign" element={<ClientAssign />} />
          <Route path="patients/:id/feedback" element={<ClientSendFeedback />} />
          <Route path="library" element={<ClientLibrary />} />
          <Route path="settings" element={<ClientSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
