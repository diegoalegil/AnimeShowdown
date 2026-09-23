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

/**
 * Estado que acompaña a una entrada del historial. `galeria` indica que la
 * ficha se abrió desde la galería (así «volver» puede ir atrás de verdad y
 * recuperar su scroll); se conserva al pasar de una ficha a otra.
 */
export function estadoPara(destino, { desde, estadoActual, reemplazar }) {
  if (!destino.startsWith('/carta/')) return undefined
  if (reemplazar) return estadoActual?.galeria ? { galeria: true } : undefined
  return desde === '/' ? { galeria: true } : undefined
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
      if (lamina) nombrarCompartido(lamina)
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
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
    } else if (tipo === 'POP') {
      window.scrollTo(0, posiciones.get(key) ?? 0)
    } else if (!mismaPagina && !conservar) {
      window.scrollTo(0, 0)
    }
    alMostrarPagina?.()
  }, [key, hash, tipo, pathname, conservar])
}
