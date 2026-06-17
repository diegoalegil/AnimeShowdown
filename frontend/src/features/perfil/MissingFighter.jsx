import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useReducedMotionPref } from '../../hooks/useReducedMotionPref'

/**
 * MissingFighter — estado 404 del perfil público (/u/:username), contado como
 * transmisión interrumpida del archivo de la federación. El noindex del 404
 * sigue viviendo en el useSeo de UsuarioPage.
 *
 * Escena: marco de retrato vacío 2:3 con una silueta de tinta. Tres copias
 * apiladas de la silueta — recortadas con clip-path ESTÁTICO en franjas
 * horizontales que juntas reconstruyen la figura completa — hacen jitter con
 * translateX en steps(2) en RÁFAGAS espaciadas; una cuarta copia cian
 * (--color-electric, señal puntual permitida) al 15% se desplaza 2px en cada
 * ráfaga como RGB-split contenido. Sobre el marco cae el sello 不明 con
 * overshoot (una sola vez) y el username buscado se teclea en mono con caret.
 * Es el único glitch del producto, con intención narrativa: la señal del
 * luchador se perdió.
 *
 * Perf (reglas Kessen):
 * - Solo transform/opacity; los clip-path se fijan una vez y nunca se animan.
 * - Las ráfagas van por setTimeout espaciado (2.2–4.4s), no por loop continuo,
 *   y se saltan si el marco está fuera del viewport o la pestaña oculta.
 * - El caret (único loop infinito) se pausa fuera del viewport vía
 *   animation-play-state; html.as-tab-hidden ya cubre la pestaña oculta.
 * - prefers-reduced-motion: escena estática — sello puesto, interferencia
 *   congelada (franja central a -2px, copia cian fija al 15%).
 * - Sin blur/backdrop-blur/SVG filters nuevos; cero libs nuevas (el sello es
 *   un keyframe play-once, sin framer). Keyframes msf-* en index.css (CSP).
 */

// Bandas (% de alto) de cada capa. Juntas suman 0–100: en reposo la silueta
// se ve entera; en ráfaga cada capa se desplaza con amplitud y fase propias.
const BANDAS_BASE = [[0, 34], [52, 66], [90, 100]]
const BANDAS_MEDIA = [[34, 52]]
const BANDAS_BAJA = [[66, 90]]

// Varias franjas horizontales en un único polygon: entre banda y banda el
// path baja pegado al borde lateral (segmentos de área cero).
const poligonoFranjas = (bandas) =>
  `polygon(${bandas
    .map(([a, b]) => `0% ${a}%, 100% ${a}%, 100% ${b}%, 0% ${b}%`)
    .join(', ')})`

/** Una copia de la silueta de tinta (cabeza + busto). La capa cian usa el
 *  eléctrico de marca; las de tinta, un lavado surface-alt → surface. */
function Silueta({ cian = false, style }) {
  const relleno = cian
    ? 'bg-electric'
    : 'bg-gradient-to-b from-surface-alt to-surface'
  return (
    <div aria-hidden="true" className="absolute inset-0" style={style}>
      <div
        className={`absolute left-1/2 top-[17%] aspect-[1/1.04] w-[34%] -translate-x-1/2 rounded-full ${relleno}`}
      />
      <div
        className={`absolute bottom-[-2%] left-1/2 top-[38.5%] w-[80%] -translate-x-1/2 rounded-t-[46%] rounded-b-[10px] ${relleno}`}
      />
    </div>
  )
}

function MissingFighter({ username = '' }) {
  const nombre = String(username || 'desconocido')
  const reducido = useReducedMotionPref()

  // Texto tecleado del username + flag de "búsqueda terminada". Con
  // reduced-motion el resultado se DERIVA (no hay tecleo que correr).
  const [escrito, setEscrito] = useState('')
  const [busquedaHecha, setBusquedaHecha] = useState(false)
  // true solo durante una ráfaga de interferencia (~340ms).
  const [rafaga, setRafaga] = useState(false)
  // En viewport + pestaña visible → habilita ráfagas y caret.
  const [activo, setActivo] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  )

  const marcoRef = useRef(null)
  const activoRef = useRef(true)
  useEffect(() => {
    activoRef.current = activo
  }, [activo])

  // Tecleo del username, como búsqueda en vivo contra el archivo. El reset
  // va dentro del primer timeout: nada de setState síncrono en el effect.
  useEffect(() => {
    if (reducido) return undefined
    let vivo = true
    let id = 0
    const teclea = (i) => {
      if (!vivo) return
      if (i > nombre.length) {
        setBusquedaHecha(true)
        return
      }
      setEscrito(nombre.slice(0, i))
      id = window.setTimeout(() => teclea(i + 1), 42 + Math.random() * 40)
    }
    id = window.setTimeout(() => {
      if (!vivo) return
      setEscrito('')
      setBusquedaHecha(false)
      teclea(0)
    }, 350)
    return () => {
      vivo = false
      window.clearTimeout(id)
    }
  }, [nombre, reducido])

  // Pausa fuera del viewport / pestaña oculta (loops fuera de vista = 0
  // coste). El IO emite su estado inicial de forma asíncrona; aquí solo
  // escuchan los listeners.
  useEffect(() => {
    const enViewport = { current: true }
    const sync = () =>
      setActivo(enViewport.current && document.visibilityState !== 'hidden')
    let io
    if (marcoRef.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          enViewport.current = entry.isIntersecting
          sync()
        },
        { threshold: 0.05 },
      )
      io.observe(marcoRef.current)
    }
    document.addEventListener('visibilitychange', sync)
    return () => {
      io?.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  // Ráfagas espaciadas (no loop continuo): cadena de timeouts con jitter.
  useEffect(() => {
    if (reducido) return undefined
    let vivo = true
    let id = 0
    const dispara = () => {
      if (!activoRef.current) return
      setRafaga(true)
      window.setTimeout(() => {
        if (vivo) setRafaga(false)
      }, 340)
    }
    const programa = (espera) => {
      id = window.setTimeout(() => {
        if (!vivo) return
        dispara()
        programa(2200 + Math.random() * 2200)
      }, espera)
    }
    programa(1400) // la primera, justo después de que asiente el sello
    return () => {
      vivo = false
      window.clearTimeout(id)
    }
  }, [reducido])

  const textoEscrito = reducido ? nombre : escrito
  const hecha = reducido || busquedaHecha
  const interferencia = rafaga || reducido

  return (
    <section className="flex flex-1 items-center justify-center px-5 py-16 sm:py-24">
      <div className="flex max-w-4xl flex-wrap items-center justify-center gap-12 sm:gap-16">
        {/* Marco de retrato vacío 2:3 — área de interferencia acotada */}
        <div ref={marcoRef} className="relative w-[clamp(216px,56vw,264px)] shrink-0">
          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-bg to-canvas shadow-elev-2 inset-shadow-hairline">
            {/* Copia cian: RGB-split contenido, solo durante la ráfaga
                (congelada en on con reduced-motion) */}
            <Silueta
              cian
              style={{
                opacity: interferencia ? 0.15 : 0,
                transform: interferencia ? 'translateX(2px)' : 'translateX(0)',
              }}
            />
            {/* Tres franjas estáticas que jitterean con fase/amplitud propias */}
            <Silueta
              style={{
                clipPath: poligonoFranjas(BANDAS_BASE),
                '--msf-amp': '3px',
                animation: rafaga ? 'msf-jit 260ms steps(2, end) 1 both' : 'none',
              }}
            />
            <Silueta
              style={{
                clipPath: poligonoFranjas(BANDAS_MEDIA),
                '--msf-amp': '-4px',
                animation: rafaga
                  ? 'msf-jit 220ms steps(2, end) 60ms 1 both'
                  : 'none',
                transform: reducido ? 'translateX(-2px)' : undefined,
              }}
            />
            <Silueta
              style={{
                clipPath: poligonoFranjas(BANDAS_BAJA),
                '--msf-amp': '2.5px',
                animation: rafaga
                  ? 'msf-jit 240ms steps(2, end) 30ms 1 both'
                  : 'none',
              }}
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-border/60 bg-bg/90 px-3.5 py-2.5 font-mono text-2xs text-fg-muted">
              <span>expediente</span>
              <span>sin registro</span>
            </div>
          </div>

          {/* Sello 不明: cae con overshoot, una sola vez */}
          <div
            aria-hidden="true"
            className="msf-stamp absolute -right-4 top-5 flex flex-col gap-0.5 rounded-[10px] border-[3px] border-hanko bg-hanko/5 px-2.5 py-3 text-hanko opacity-0 drop-shadow-scrim-sm"
          >
            <span lang="ja" className="font-kanji-serif text-[34px] font-bold leading-none">不</span>
            <span lang="ja" className="font-kanji-serif text-[34px] font-bold leading-none">明</span>
          </div>
        </div>

        {/* Lado de texto: búsqueda fallida + salida */}
        <div className="flex min-w-[260px] max-w-sm flex-1 basis-72 flex-col gap-5">
          <p className="text-[13px] font-semibold text-gold">
            Archivo de la federación
          </p>
          <h1 className="font-display text-[clamp(2.1rem,5vw,3rem)] leading-tight tracking-tight text-fg-strong">
            Señal perdida
          </h1>

          <div className="flex flex-col gap-1.5 font-mono text-sm">
            <p className="text-fg-muted">
              &gt; buscar_luchador:{' '}
              <span className="text-fg-strong">&quot;{textoEscrito}&quot;</span>
              <span
                aria-hidden="true"
                className="msf-caret ml-1 inline-block h-[1em] w-[0.55em] translate-y-[0.12em] bg-fg"
                style={{ animationPlayState: activo ? 'running' : 'paused' }}
              />
            </p>
            <p
              className="text-[13px] text-accent-text transition-opacity duration-300"
              style={{ opacity: hecha ? 1 : 0 }}
            >
              0 coincidencias en el archivo de la federación
            </p>
          </div>

          <p className="max-w-[42ch] text-[15px] leading-relaxed text-fg-muted">
            Ningún luchador responde a ese nombre. Puede que haya cambiado de
            alias o que nunca haya pisado la arena.
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-4">
            <Link
              to="/ranking"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-gold-subtle px-5 text-sm font-semibold text-gold transition-colors hover:border-border-gold hover:bg-gold-soft hover:text-gold-bright"
            >
              <Search className="h-4 w-4" />
              Buscar entre los luchadores activos
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center text-sm text-fg-muted transition-colors hover:text-fg"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default MissingFighter
