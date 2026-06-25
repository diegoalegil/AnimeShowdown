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
import './styles/display-font.css'
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
    // Solo recargar en una actualización MID-SESIÓN (pestaña abierta un rato),
    // que es cuando el shell viejo persiste. Si el controllerchange ocurre
    // durante el arranque (primeros ~10s), la página YA cargó con el HTML y los
    // chunks frescos (HTML max-age=0 + chunks NetworkFirst): el cambio es solo
    // el SW nuevo tomando el control, y recargar no aporta nada — solo provoca
    // un parpadeo y pierde scroll/estado en cada visitante tras cada deploy.
    if (performance.now() < 10000) return
    swRecargado = true
    window.location.reload()
  })
}

// Observabilidad (Sentry) tras el primer paint, en idle: el SDK de Sentry
// (~80-100KB gzip) se trae con import() DIFERIDO para no inflar el bundle de
// entrada ni competir con el render inicial. No-op si no hay DSN. Los errores
// anteriores a su carga NO se pierden: la fachada Sentry.captureException
// (lib/sentry.js) dispara la carga bajo demanda.
function startSentry() {
  let started = false
  // Interacciones intencionales (no mousemove, que dispararía casi al instante).
  const events = ['pointerdown', 'keydown', 'touchstart', 'scroll']
  const run = () => {
    if (started) return
    started = true
    events.forEach((evt) => window.removeEventListener(evt, run))
    initSentry()
  }
  // Carga en la PRIMERA interacción real del usuario (cuando la observabilidad
  // empieza a importar), o tras un idle LARGO si no interactúa — lo que ocurra
  // antes. Así Sentry no compite con el paint/LCP inicial. Antes cargaba en
  // idle a ~700ms (o inmediato vía setTimeout(0) en navegadores sin idle).
  events.forEach((evt) => window.addEventListener(evt, run, { once: true, passive: true }))
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 10000 })
  } else {
    window.setTimeout(run, 5000)
  }
}
if (document.readyState === 'complete') {
  startSentry()
} else {
  window.addEventListener('load', startSentry, { once: true })
}

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
// El prerender SSR-light inyecta un bloque JSON-LD (#seo-prerender-jsonld) en el
// HTML para crawlers sin JS. Al arrancar la SPA, JsonLd.jsx inyecta su propio
// JSON-LD por ruta → un crawler que ejecuta JS (Googlebot) vería DOS bloques. Lo
// retiramos en el boot: el crawler sin JS conserva el prerenderizado (esto no se
// ejecuta para él) y el que ejecuta JS se queda solo con el de ruta.
document.getElementById('seo-prerender-jsonld')?.remove()

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
