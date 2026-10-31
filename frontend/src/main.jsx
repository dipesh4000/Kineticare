import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './dark.css'
import { initialTheme } from './theme'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import RecordsProvider from './records/RecordsProvider.jsx'
import PWAInstallPrompt from './components/PWAInstallPrompt.jsx'

document.documentElement.dataset.theme = initialTheme()
document.documentElement.style.colorScheme = document.documentElement.dataset.theme

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PWAInstallPrompt />
    <AuthProvider>
      <RecordsProvider>
        <App />
      </RecordsProvider>
    </AuthProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('App installation service worker could not register:', error);
    });
  }, { once: true });
}
