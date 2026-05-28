import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { SoundProvider } from './contexts/SoundContext.jsx'
import { queryClient } from './lib/queryClient.js'
import { initSentry } from './lib/sentry.js'
import {
  installStaleAssetRecovery,
  recoverFromStaleAssetError,
} from './lib/staleAssetRecovery.js'
import './lib/i18n.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import App from './App.jsx'

function startWebVitals() {
  const loadVitals = () => {
    import('./lib/vitals.js')
      .then(({ initWebVitals }) => initWebVitals())
      .catch(recoverFromStaleAssetError)
  }

  const scheduleVitals = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadVitals, { timeout: 3500 })
      return
    }
    window.setTimeout(loadVitals, 0)
  }

  if (document.readyState === 'complete') {
    scheduleVitals()
  } else {
    window.addEventListener('load', scheduleVitals, { once: true })
  }
}

// Primer guardarraíl del bootstrap: si una pestaña antigua o el Service
// Worker pide un chunk ya reemplazado y Cloudflare responde index.html,
// Safari lanza "text/html is not a valid JavaScript MIME type". Limpiamos
// caches runtime y recargamos una vez antes de dejar caer la app al boundary.
installStaleAssetRecovery()

// Tras un deploy, el SW nuevo se activa (skipWaiting + clientsClaim) pero la
// pestaña abierta sigue ejecutando el bundle viejo: en una SPA con navegación
// client-side el shell viejo persiste hasta que el usuario hace hard-refresh.
// Recargamos UNA sola vez cuando un SW NUEVO toma el control (controllerchange
// con un controller previo => actualización, no primera instalación), para que
// el contenido nuevo aparezca sin intervención manual.
if ('serviceWorker' in navigator) {
  const teniaController = Boolean(navigator.serviceWorker.controller)
  let swRecargado = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRecargado || !teniaController) return
    swRecargado = true
    window.location.reload()
  })
}

// Bootstrap Sentry antes de montar React. No-op si VITE_SENTRY_DSN no está
// definida (dev local sin env).
initSentry()

// Web Vitals → Sentry measurements. Se carga tras load/idle para que la
// observabilidad no compita con el render inicial.
startWebVitals()

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
