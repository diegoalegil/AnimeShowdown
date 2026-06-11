// Estado del morph scene → hero del catálogo de animes, sobre el motor
// genérico de viewTransitions. La ida marca la cover clickada como origen
// (mismo patrón que personaje-hero); la vuelta se decide en el settle — con
// el scroll ya reseteado — y solo si el hero viajaba en la captura vieja y
// la card sigue lo bastante visible: nunca un morph hacia un destino medio
// oculto ni un grupo sin origen al entrar al catálogo desde rutas sin hero.

import {
  animeSceneMorph,
  queueSettleAdopt,
  supportsViewTransitions,
} from './viewTransitions'

// slug → cover montada en el grid. Solo las cards eager de las primeras
// filas importan en la práctica: tras el scroll-reset de la vuelta
// únicamente ellas pueden superar la cuota de visibilidad.
const cards = new Map()
let returnSlug = null
let morphEntry = false

// Cuota mínima visible de la cover (sobre su alto, post scroll-reset) para
// que la vuelta contraiga el hero hacia ella. Por debajo, mejor el corte
// del root que un morph volando hacia un elemento medio oculto.
const MIN_VISIBLE = 0.35

function coverVisible(el) {
  const r = el.getBoundingClientRect()
  if (r.height === 0 || r.bottom <= 0 || r.top >= window.innerHeight) return false
  const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)
  return visible / r.height >= MIN_VISIBLE
}

/**
 * Ida: marca la cover clickada como origen del morph. SOLO desde el
 * onViewTransitionStart de AppLink (mismos guards que personaje-hero).
 */
export function markAnimeScene(slug) {
  // AppLink ya guarda por soporte, pero la señal de entrada-vía-morph no
  // puede levantarse sin transición: el hero se saltaría el slow-zoom sin
  // que ningún morph lo sustituya.
  if (!supportsViewTransitions()) return
  const el = cards.get(slug)
  if (!el) return
  animeSceneMorph.mark(el)
  morphEntry = true
}

/**
 * true ⇒ el hero que está montando llegó vía morph (gate del slow-zoom: el
 * morph ES la entrada). Lectura pura pensada para un lazy initializer de
 * useState — con StrictMode el initializer corre dos veces y una lectura
 * que consumiera la señal devolvería false en la segunda. La señal la
 * consume mountSceneHero al adoptar, ya en fase de effects.
 */
export function peekAnimeSceneMorphEntry() {
  return morphEntry
}

/**
 * Hero del detalle: adopta el nombre de forma estable (destino de la ida,
 * origen de la vuelta) y recuerda el slug para que la card del grid pueda
 * reclamar el morph de vuelta. Devuelve el cleanup para el layout effect.
 */
export function mountSceneHero(el, slug) {
  morphEntry = false
  animeSceneMorph.adopt(el)
  returnSlug = slug
  return () => animeSceneMorph.release(el)
}

/**
 * Cover del catálogo: se registra para la ida y, si es la vuelta desde SU
 * detalle, encola la adopción para el settle. Devuelve el cleanup para el
 * layout effect.
 */
export function mountSceneCard(el, slug) {
  cards.set(slug, el)
  if (returnSlug === slug && supportsViewTransitions()) {
    returnSlug = null
    // Marca TRANSITORIA: si el morph de vuelta no cuaja, el finished de la
    // transición la limpia y el grid no arrastra un grupo fantasma a la
    // siguiente navegación. heldAtCapture descarta el caso de un returnSlug
    // antiguo (detalle → otra ruta → catálogo): sin hero en la captura
    // vieja, el grupo no tendría origen y la card entraría desincronizada
    // del page-in del root.
    queueSettleAdopt(() => {
      if (animeSceneMorph.heldAtCapture() && el.isConnected && coverVisible(el)) {
        animeSceneMorph.mark(el)
      }
    })
  }
  return () => {
    if (cards.get(slug) === el) cards.delete(slug)
    animeSceneMorph.release(el)
  }
}
