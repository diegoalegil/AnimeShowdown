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
export const ANIME_SCENE_VT = 'anime-scene'
export const RITO_ACUNACION_VT = 'rito-acunacion'

// Tiempo máximo congelado esperando el commit de React. Si vence, la
// transición se asienta con el contenido que haya (equivale al corte de
// siempre); nunca dejamos la página congelada al ritmo del chunk.
const SETTLE_WATCHDOG_MS = 1500

// Tipo de la transición de ruta por defecto («el intermedio»): un corte de
// tinta vertical sobre el grupo root. index.css lo lee vía
// :root:active-view-transition-type(intermedio); solo se marca en las
// navegaciones SIN morph propio (las que llevan morph dejan mandar a su grupo
// nombrado). Cero estado/refs/setState: seguro con React 19 + React Compiler.
const INTERMEDIO_TYPE = 'intermedio'

// ¿Soporta el UA la firma con `types`? (Chrome 125+, Safari 18.2+). Se detecta
// por el selector real, no por user-agent. Sin soporte caemos a la firma
// callback y la navegación usa la animación base del root (lift-fade de
// index.css): degradación limpia, nunca rota.
const SUPPORTS_VT_TYPES =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('selector(:active-view-transition-type(x))')

let settlePending = null
let watchdogId = 0
let settleAdopt = null

export function supportsViewTransitions(doc = typeof document === 'undefined' ? null : document) {
  if (!doc || typeof doc.startViewTransition !== 'function') return false
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
}

/**
 * Encola una función que correrá en el settle de la transición en curso,
 * con el scroll YA reseteado por App.jsx (su scrollTo(0,0) va en su layout
 * effect, que corre DESPUÉS del de la página hija) y ANTES de resolver la
 * captura del estado nuevo. Es el hueco donde un destino del morph de
 * vuelta puede decidir si adopta el nombre: la card del grid no puede
 * decidir por sí sola en su propio layout effect porque el viewport aún
 * tiene el scroll de la página saliente.
 *
 * Sin transición pendiente la función encolada se descarta sin ejecutarse
 * (una navegación por popstate no pasa por aquí y marcar dejaría un nombre
 * residual sin transición que lo limpie).
 */
export function queueSettleAdopt(fn) {
  settleAdopt = fn
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
  const adopt = settleAdopt
  settleAdopt = null
  if (!settlePending) return
  adopt?.()
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
  // La captura del estado viejo ocurre al invocar startViewTransition: cada
  // morph recuerda si su nombre viajaba en ella (heldAtCapture). La adopción
  // diferida del settle lo consulta para no crear un grupo sin origen.
  personajeHeroMorph.snapshotCapture()
  animeSceneMorph.snapshotCapture()
  // Un morph en vuelo (su nombre viajaba en la captura del estado viejo) NO
  // recibe el intermedio: manda su grupo nombrado y el root se queda con su
  // lift-fade base. El RESTO de navegaciones se marcan `intermedio`.
  const morphEnVuelo =
    personajeHeroMorph.heldAtCapture() || animeSceneMorph.heldAtCapture()
  const update = () =>
    new Promise((resolve) => {
      settlePending = resolve
      navigateFn()
      watchdogId = window.setTimeout(settleNavigationViewTransition, SETTLE_WATCHDOG_MS)
    })
  const transition =
    SUPPORTS_VT_TYPES && !morphEnVuelo
      ? document.startViewTransition({ update, types: [INTERMEDIO_TYPE] })
      : document.startViewTransition(update)
  // Una transición saltada (timeout del UA, nombres duplicados, otra nav)
  // rechaza estas promesas; sin catch acabarían como errores de consola.
  transition.ready.catch(() => {})
  transition.finished.then(clearTransients, clearTransients)
}

// ---------------------------------------------------------------------------
// Morphs compartidos origen → destino (carta → hero de personaje, scene de
// card → hero de anime). Solo UN elemento del documento puede llevar cada
// view-transition-name por captura — un duplicado aborta la transición EN
// SILENCIO — así que cada nombre vive en un holder centralizado: marcar
// siempre libera al anterior (incluido el hero del detalle al navegar
// detalle → detalle vía cartas de similares o módulos del hub).

function createSharedMorphName(name) {
  let holder = null
  let transient = false
  let heldAtCapture = false

  function set(el, isTransient) {
    if (holder && holder !== el) {
      holder.style.removeProperty('view-transition-name')
    }
    holder = el
    transient = isTransient
    el.style.setProperty('view-transition-name', name)
  }

  return {
    /**
     * Marca transitoriamente el origen del morph (la carta/cover clickada).
     * Llamar desde el onViewTransitionStart de AppLink, que corre ANTES de
     * iniciar la transición (la captura del estado viejo necesita el nombre
     * puesto) pero SOLO cuando los guards pasan: en un click modificado
     * (cmd/ctrl, pestaña nueva) no hay transición que limpie la marca y
     * quedaría residual. Si la navegación no llega a cuajar, la marca se
     * limpia sola al terminar la transición.
     */
    mark(el) {
      if (!el || !supportsViewTransitions()) return
      set(el, true)
    },
    /**
     * El destino estable (hero del detalle) adopta el nombre: destino del
     * morph de entrada y origen del de salida. Llamar desde un layout effect.
     */
    adopt(el) {
      if (!el || !supportsViewTransitions()) return
      set(el, false)
    },
    /** Libera el nombre al desmontar el elemento que lo tenía. */
    release(el) {
      if (!el) return
      el.style.removeProperty('view-transition-name')
      if (holder === el) {
        holder = null
        transient = false
      }
    },
    /**
     * Si la transición terminó y la marca sigue siendo la transitoria de un
     * origen (navegación abortada / sin morph de destino), se retira para que
     * una transición posterior no arrastre un grupo fantasma desde el grid.
     */
    clearTransient() {
      if (holder && transient) {
        this.release(holder)
      }
    },
    /** Congela, al iniciar una transición, si el nombre viaja en la captura
        del estado viejo. Solo tiene sentido leerlo durante esa transición. */
    snapshotCapture() {
      heldAtCapture = holder !== null
    },
    heldAtCapture() {
      return heldAtCapture
    },
  }
}

export const personajeHeroMorph = createSharedMorphName(PERSONAJE_HERO_VT)
export const animeSceneMorph = createSharedMorphName(ANIME_SCENE_VT)

// API original del morph de personaje, intacta para sus consumidores.
export function markPersonajeHero(el) {
  personajeHeroMorph.mark(el)
}

export function adoptPersonajeHero(el) {
  personajeHeroMorph.adopt(el)
}

export function releasePersonajeHero(el) {
  personajeHeroMorph.release(el)
}

function clearTransients() {
  personajeHeroMorph.clearTransient()
  animeSceneMorph.clearTransient()
  // Una adopción encolada que nunca llegó a settle no debe filtrarse a la
  // siguiente navegación.
  settleAdopt = null
}

// ---------------------------------------------------------------------------
// Rito de acuñación (registro → home): morph ONE-SHOT de la placa del nuevo
// luchador hacia el avatar del header. A diferencia de los morphs de holder
// (origen y destino son instancias del mismo lienzo), aquí el nombre SALTA de
// elemento dentro del callback: la placa lo lleva en la captura vieja, el
// avatar en la nueva, y se limpia pase lo que pase al terminar.
//
// El header monta DOS avatares (cluster <1120px y UserBadge desktop) y el CSS
// decide cuál se ve: un elemento display:none no se captura (el grupo quedaría
// sin destino), así que se registran todos y el morph elige el visible.

const ritoAvatarTargets = new Set()

export function registerRitoAvatarTarget(el) {
  if (el) ritoAvatarTargets.add(el)
}

export function unregisterRitoAvatarTarget(el) {
  ritoAvatarTargets.delete(el)
}

function visibleRitoAvatarTarget() {
  for (const el of ritoAvatarTargets) {
    if (el.isConnected && el.getClientRects().length > 0) return el
  }
  return null
}

/**
 * Lanza la transición placa → avatar y navega. Sin soporte, con
 * reduced-motion o sin un avatar visible (logout raro, header sin user
 * todavía) navega directo: corte limpio, cero coste.
 */
export function startRitoAcunacionTransition(placaEl, navigateFn) {
  const avatarEl = supportsViewTransitions() && placaEl ? visibleRitoAvatarTarget() : null
  if (!avatarEl) {
    navigateFn()
    return
  }
  settleNavigationViewTransition()
  personajeHeroMorph.snapshotCapture()
  animeSceneMorph.snapshotCapture()
  // La captura vieja necesita el nombre en la placa; el avatar NO debe
  // llevarlo aún o habría duplicado y el UA saltaría la transición.
  placaEl.style.setProperty('view-transition-name', RITO_ACUNACION_VT)
  const transition = document.startViewTransition(
    () =>
      new Promise((resolve) => {
        settlePending = resolve
        placaEl.style.removeProperty('view-transition-name')
        avatarEl.style.setProperty('view-transition-name', RITO_ACUNACION_VT)
        navigateFn()
        watchdogId = window.setTimeout(settleNavigationViewTransition, SETTLE_WATCHDOG_MS)
      }),
  )
  transition.ready.catch(() => {})
  const cleanup = () => {
    avatarEl.style.removeProperty('view-transition-name')
    clearTransients()
  }
  transition.finished.then(cleanup, cleanup)
}
