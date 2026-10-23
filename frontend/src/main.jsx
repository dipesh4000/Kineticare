import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './modern.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import RecordsProvider from './records/RecordsProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RecordsProvider>
        <App />
      </RecordsProvider>
    </AuthProvider>
  </StrictMode>,
)
