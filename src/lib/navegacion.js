// Navegación de la aplicación sin un listener por enlace: los enlaces son
// <a href> normales y un único listener en el documento decide cuáles se
// resuelven dentro de la SPA (con View Transition) y cuáles deja al navegador.
//
// Atributos que entiende un enlace interno:
//   data-reemplazar          sustituye la entrada del historial (fichas vecinas)
//   data-direccion="…"       tipo de transición («anterior», «siguiente»)
import { useEffect, useLayoutEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { conTransicion, nombrarCompartido } from './motion.js'

/**
 * Ruta de la aplicación para un pathname absoluto, o null si queda fuera de
 * la base ("/AnimeShowdown/carta/x" con base "/AnimeShowdown/" → "/carta/x").
 */
export function rutaInterna(pathname, base = '/') {
  const b = base.endsWith('/') ? base : `${base}/`
  if (pathname === b.slice(0, -1)) return '/'
  if (!pathname.startsWith(b)) return null
  return `/${pathname.slice(b.length)}`
}

/**
 * Decide si un clic debe resolverse dentro de la aplicación. Devuelve
 * { destino: "/ruta?busqueda#ancla", enlace, reemplazar, direccion } o null
 * para dejar actuar al navegador.
 */
export function destinoDeClic(evento, { base, actual }) {
  if (evento.defaultPrevented || evento.button !== 0) return null
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return null
  const enlace = evento.target?.closest?.('a[href]')
  if (!enlace) return null
  if ((enlace.target && enlace.target !== '_self') || enlace.hasAttribute('download')) return null

  const url = new URL(enlace.href, actual.href)
  if (url.origin !== actual.origin) return null
  // Anclas dentro de la misma página («Saltar al contenido»): las gestiona el navegador.
  if (url.hash && url.pathname === actual.pathname && url.search === actual.search) return null
  const ruta = rutaInterna(url.pathname, base)
  if (ruta === null) return null
  return {
    destino: ruta + url.search + url.hash,
    enlace,
    reemplazar: enlace.hasAttribute('data-reemplazar'),
    direccion: enlace.getAttribute?.('data-direccion') || undefined,
  }
}

// Páginas de cartas a las que una ficha puede volver yendo atrás de verdad.
const ORIGENES = new Set(['/', '/coleccion'])

/**
 * Estado que acompaña a una entrada del historial. `volver` es la página de
 * cartas desde la que se abrió la ficha (la galería o la colección): así
 * «volver» puede ir atrás de verdad y recuperar su scroll. Se conserva al
 * pasar de una ficha a otra.
 */
export function estadoPara(destino, { desde, estadoActual, reemplazar }) {
  if (!destino.startsWith('/carta/')) return undefined
  // GitHub Pages sirve cada sección como carpeta: «/coleccion/» es «/coleccion».
  const origen = (reemplazar ? estadoActual?.volver : desde)?.replace(/(.)\/+$/, '$1')
  return ORIGENES.has(origen) ? { volver: origen } : undefined
}

/**
 * Navega dentro de la aplicación con View Transition. La usan el listener
 * delegado y los atajos de teclado de la ficha.
 */
export function irA(navigate, destino, { reemplazar = false, direccion, estado, conservarScroll = false } = {}) {
  const state = conservarScroll ? { ...estado, conservarScroll: true } : estado
  return conTransicion(() => flushSync(() => navigate(destino, { replace: reemplazar, state })), { tipo: direccion })
}

/**
 * Intercepta los clics en enlaces internos y navega con una View
 * Transition. La ilustración de la carta pulsada (si la hay) se convierte
 * en el elemento compartido de la transición.
 */
export function useNavegacionDelegada() {
  const navigate = useNavigate()

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    function alPulsar(evento) {
      const resultado = destinoDeClic(evento, { base, actual: window.location })
      if (!resultado) return
      evento.preventDefault()
      const { destino, enlace, reemplazar, direccion } = resultado
      const lamina = enlace.querySelector('.carta-lamina')
      if (lamina) {
        nombrarCompartido(lamina)
        // La primera entrada del historial no tiene estado: react-router la llama «default».
        anclar(lamina, window.history.state?.key ?? 'default')
      }
      const estado = estadoPara(destino, {
        desde: rutaInterna(window.location.pathname, base),
        estadoActual: window.history.state?.usr,
        reemplazar,
      })
      irA(navigate, destino, { reemplazar, direccion, estado })
    }
    document.addEventListener('click', alPulsar)
    return () => document.removeEventListener('click', alPulsar)
  }, [navigate])
}

// ---------------------------------------------------------------------------
// Volver atrás con transición. El cambio de ruta tras history.back() llega
// de forma asíncrona (popstate), así que la View Transition espera a que la
// página anterior haya restaurado su scroll (aviso desde useRestaurarScroll).
// ---------------------------------------------------------------------------

let alMostrarPagina = null

function esperarPagina(maximoMs = 500) {
  return new Promise((resolve) => {
    const fin = () => {
      clearTimeout(tope)
      if (alMostrarPagina === fin) alMostrarPagina = null
      resolve()
    }
    const tope = setTimeout(fin, maximoMs)
    alMostrarPagina = fin
  })
}

/**
 * history.back() animado. `alLlegar` se ejecuta con la página anterior ya
 * montada y antes de capturarla (p. ej. para nombrar la carta de destino).
 */
export function volverAtras(navigate, { alLlegar } = {}) {
  return conTransicion(() => {
    const lista = esperarPagina()
    navigate(-1)
    return lista.then(() => alLlegar?.())
  }).finally(() => nombrarCompartido(null))
}

// ---------------------------------------------------------------------------
// Scroll: arriba al entrar en una página nueva, la posición anterior al
// volver con atrás/adelante y quieto si solo cambia la búsqueda (?q=…) o si
// la navegación lo pide (cambiar de versión en la ficha).
// ---------------------------------------------------------------------------

const posiciones = new Map()

// La primera página se muestra sin haber navegado: un POP entonces es la
// carga inicial, no una vuelta atrás (las dos usan la clave «default»).
let yaNavego = false

/** true si la página se monta al volver con atrás/adelante (no en la carga inicial). */
export const esVuelta = (tipo) => tipo === 'POP' && yaNavego

// Ancla de vuelta: la carta que se abrió desde una página larga y a qué
// altura de la pantalla estaba. Al volver, la página se coloca para que esa
// carta (o la última que se vio en la ficha) quede en el mismo sitio. Es más
// fiable que la posición en píxeles: con content-visibility, las cartas fuera
// de pantalla miden lo que se estima, no lo que midieron la otra vez.
let ancla = null
const TIEMPO_ANCLA_MS = 700

function anclar(elemento, key) {
  const carta = elemento.closest?.('[data-id]')
  ancla = carta ? { key, ids: [carta.dataset.id], top: carta.getBoundingClientRect().top } : null
}

/** Cartas a las que se volverá desde la ficha (vacío si no hay ancla). */
export const idsAncla = () => ancla?.ids ?? []

/** La ficha avisa de la carta que se ve (y su alternativa, p. ej. la normal de una especial). */
export function actualizarAncla(ids) {
  if (ancla) ancla.ids = ids
}

/**
 * Deja `elemento` a `top` píxeles del borde superior de la pantalla y lo
 * mantiene ahí un momento. Las secciones cercanas se pintan con su tamaño
 * real en los frames siguientes (content-visibility; en Safari, después de la
 * View Transition) sin que el navegador ancle el scroll: se sigue
 * recolocando y se deja en cuanto el visitante hace scroll.
 */
function sostenerEn(elemento, top) {
  const colocar = () => {
    const desvio = Math.round(elemento.getBoundingClientRect().top - top)
    if (desvio) window.scrollBy(0, desvio)
  }
  colocar()
  const hasta = performance.now() + TIEMPO_ANCLA_MS
  // El tiempo se mira antes de recolocar: si los frames se retrasan (pestaña
  // en segundo plano), un frame tardío no devuelve la página a su sitio
  // después de que el visitante se haya movido.
  let frame = requestAnimationFrame(function seguir(ahora) {
    if (ahora >= hasta) {
      soltar()
      return
    }
    colocar()
    frame = requestAnimationFrame(seguir)
  })
  const soltar = () => {
    cancelAnimationFrame(frame)
    for (const tipo of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.removeEventListener(tipo, soltar)
  }
  for (const tipo of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(tipo, soltar, { passive: true })
}

function restaurarAncla(key) {
  if (!ancla || ancla.key !== key) return false
  const { ids, top } = ancla
  const carta = ids.map((id) => document.querySelector(`[data-id="${CSS.escape(id)}"]`)).find(Boolean)
  if (!carta) return false
  sostenerEn(carta, top)
  return true
}

/** Lleva a un ancla de la página (#…) respetando su scroll-margin-top. */
function irAAncla(hash) {
  const destino = document.getElementById(decodeURIComponent(hash.slice(1)))
  if (!destino) return
  sostenerEn(destino, parseFloat(getComputedStyle(destino).scrollMarginTop) || 0)
}

export function useRestaurarScroll() {
  const { key, hash, pathname, state } = useLocation()
  const tipo = useNavigationType()
  const rutaAnterior = useRef(pathname)
  const conservar = Boolean(state?.conservarScroll)

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])

  // Guarda la posición de la página actual mientras se hace scroll.
  useEffect(() => {
    let frame = 0
    const guardar = () => {
      frame = 0
      posiciones.set(key, window.scrollY)
    }
    const alHacerScroll = () => {
      if (!frame) frame = requestAnimationFrame(guardar)
    }
    window.addEventListener('scroll', alHacerScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', alHacerScroll)
      cancelAnimationFrame(frame)
    }
  }, [key])

  // En layout effect: ocurre antes de pintar y dentro de la View Transition.
  useLayoutEffect(() => {
    const mismaPagina = rutaAnterior.current === pathname
    rutaAnterior.current = pathname
    if (hash) {
      irAAncla(hash)
    } else if (tipo === 'POP') {
      window.scrollTo(0, posiciones.get(key) ?? 0)
      restaurarAncla(key)
    } else if (!mismaPagina && !conservar) {
      window.scrollTo(0, 0)
    }
    yaNavego = true
    alMostrarPagina?.()
  }, [key, hash, tipo, pathname, conservar])
}
