import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './dark.css'
import { initialTheme } from './theme'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import RecordsProvider from './records/RecordsProvider.jsx'

document.documentElement.dataset.theme = initialTheme()
document.documentElement.style.colorScheme = document.documentElement.dataset.theme

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RecordsProvider>
        <App />
      </RecordsProvider>
    </AuthProvider>
  </StrictMode>,
)
