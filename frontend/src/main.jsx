import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { SoundProvider } from './contexts/SoundContext.jsx'
import { queryClient } from './lib/queryClient.js'
import { initSentry } from './lib/sentry.js'
import { initWebVitals } from './lib/vitals.js'
import { installStaleAssetRecovery } from './lib/staleAssetRecovery.js'
import './lib/i18n.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import App from './App.jsx'

// Primer guardarraíl del bootstrap: si una pestaña antigua o el Service
// Worker pide un chunk ya reemplazado y Cloudflare responde index.html,
// Safari lanza "text/html is not a valid JavaScript MIME type". Limpiamos
// caches runtime y recargamos una vez antes de dejar caer la app al boundary.
installStaleAssetRecovery()

// Bootstrap Sentry antes de montar React. No-op si VITE_SENTRY_DSN no está
// definida (dev local sin.env). 7.
initSentry()

// Web Vitals → Sentry measurements. En dev sin DSN solo log a consola.
// 8.
initWebVitals()

// QueryClientProvider envuelve el árbol entero para que cualquier
// página/componente pueda usar useQuery sin pasar props. El cliente vive
// en lib/queryClient.js — singleton compartido entre tests y app.
// Se coloca DENTRO de BrowserRouter pero FUERA de Auth/Sound para
// que esos contexts puedan usar useQuery si lo necesitan en el futuro.
//
// ErrorBoundary es lo más externo posible para atrapar errores síncronos
// de cualquier provider o componente descendiente.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SoundProvider>
              <App />
            </SoundProvider>
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
