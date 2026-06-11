// Navegación con la View Transitions API (same-document, 0 dependencias).
//
// El modo declarativo de react-router (BrowserRouter + Routes) NO ejecuta
// document.startViewTransition: la prop `viewTransition` de Link/useNavigate
// solo viaja hasta history.push, que la ignora (el único consumidor está en
// el data router de RouterProvider). Esta lib aporta esa pieza: envuelve la
// navegación en una transición y deja que App.jsx "asiente" la captura del
// estado nuevo cuando React commitea la ruta entrante — con el scroll ya
// reseteado, así el snapshot de entrada se toma arriba del todo.
//
// El render de BrowserRouter va dentro de React.startTransition, así que el
// callback de startViewTransition no puede usar flushSync: devolvemos una
// promesa que se resuelve desde el useLayoutEffect de App al commitear la
// location nueva. Si la ruta lazy suspende, React retiene el commit (y la
// captura espera) hasta que el chunk llega; el watchdog y el timeout del
// propio navegador (~4s) cubren el caso patológico.

export const PERSONAJE_HERO_VT = 'personaje-hero'

// Tiempo máximo congelado esperando el commit de React. Si vence, la
// transición se asienta con el contenido que haya (equivale al corte de
// siempre); nunca dejamos la página congelada al ritmo del chunk.
const SETTLE_WATCHDOG_MS = 1500

let settlePending = null
let watchdogId = 0

export function supportsViewTransitions(doc = typeof document === 'undefined' ? null : document) {
  if (!doc || typeof doc.startViewTransition !== 'function') return false
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
}

/**
 * Asienta la transición pendiente: resuelve la promesa del callback para que
 * el navegador capture el estado nuevo. Idempotente y no-op sin transición.
 */
export function settleNavigationViewTransition() {
  if (watchdogId) {
    clearTimeout(watchdogId)
    watchdogId = 0
  }
  if (!settlePending) return
  const settle = settlePending
  settlePending = null
  settle()
}

/**
 * Ejecuta `navigateFn` dentro de una view transition. Sin soporte (o con
 * prefers-reduced-motion) navega directo: no-op limpio.
 */
export function startNavigationViewTransition(navigateFn) {
  if (!supportsViewTransitions()) {
    navigateFn()
    return
  }
  // Una transición anterior sin asentar (doble click rápido) se libera ya;
  // startViewTransition además descarta la activa al iniciar la nueva.
  settleNavigationViewTransition()
  const transition = document.startViewTransition(
    () =>
      new Promise((resolve) => {
        settlePending = resolve
        navigateFn()
        watchdogId = window.setTimeout(settleNavigationViewTransition, SETTLE_WATCHDOG_MS)
      }),
  )
  // Una transición saltada (timeout del UA, nombres duplicados, otra nav)
  // rechaza estas promesas; sin catch acabarían como errores de consola.
  transition.ready.catch(() => {})
  transition.finished.then(clearTransientPersonajeHero, clearTransientPersonajeHero)
}

// ---------------------------------------------------------------------------
// Morph compartido carta → hero del detalle. Solo UN elemento del documento
// puede llevar el view-transition-name por captura, así que el holder vive
// aquí centralizado: marcar siempre libera al anterior (incluido el hero del
// detalle al navegar detalle → detalle vía cartas de similares).

let heroHolder = null
let heroHolderTransient = false

function setHeroName(el) {
  if (heroHolder && heroHolder !== el) {
    heroHolder.style.removeProperty('view-transition-name')
  }
  heroHolder = el
  el.style.setProperty('view-transition-name', PERSONAJE_HERO_VT)
}

/**
 * Marca transitoriamente la carta clickada como origen del morph. Llamar en
 * el onClick ANTES de iniciar la transición (la captura del estado viejo
 * necesita el nombre puesto). Si la navegación no llega a cuajar, la marca
 * se limpia sola al terminar la transición.
 */
export function markPersonajeHero(el) {
  if (!el || !supportsViewTransitions()) return
  setHeroName(el)
  heroHolderTransient = true
}

/**
 * El hero del detalle adopta el nombre de forma estable (destino del morph
 * de entrada y origen del de salida). Llamar desde un layout effect.
 */
export function adoptPersonajeHero(el) {
  if (!el || !supportsViewTransitions()) return
  setHeroName(el)
  heroHolderTransient = false
}

/** Libera el nombre al desmontar el elemento que lo tenía. */
export function releasePersonajeHero(el) {
  if (!el) return
  el.style.removeProperty('view-transition-name')
  if (heroHolder === el) {
    heroHolder = null
    heroHolderTransient = false
  }
}

// Si la transición terminó y la marca sigue siendo la transitoria de una
// carta (navegación abortada / sin morph de destino), se retira para que una
// transición posterior no arrastre un grupo fantasma desde el grid.
function clearTransientPersonajeHero() {
  if (heroHolder && heroHolderTransient) {
    releasePersonajeHero(heroHolder)
  }
}
