// Navegación de la aplicación sin un listener por enlace: los enlaces son
// <a href> normales y un único listener en el documento decide cuáles se
// resuelven dentro de la SPA (con View Transition) y cuáles deja al navegador.
import { useEffect, useLayoutEffect } from 'react'
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
 * Decide si un clic debe resolverse dentro de la aplicación. Devuelve el
 * destino ("/ruta?busqueda#ancla") o null para dejar actuar al navegador.
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
  return { destino: ruta + url.search + url.hash, enlace }
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
      const lamina = resultado.enlace.querySelector('.carta-lamina')
      if (lamina) nombrarCompartido(lamina)
      conTransicion(() => flushSync(() => navigate(resultado.destino)))
    }
    document.addEventListener('click', alPulsar)
    return () => document.removeEventListener('click', alPulsar)
  }, [navigate])
}

// ---------------------------------------------------------------------------
// Scroll: arriba al entrar en una página nueva y la posición anterior al
// volver con atrás/adelante.
// ---------------------------------------------------------------------------

const posiciones = new Map()

export function useRestaurarScroll() {
  const { key, hash } = useLocation()
  const tipo = useNavigationType()

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
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
      return
    }
    window.scrollTo(0, tipo === 'POP' ? (posiciones.get(key) ?? 0) : 0)
  }, [key, hash, tipo])
}
