import { useEffect, useId, useMemo, useRef } from 'react'
import { geometriaRio, mapearHitos, GUION } from './codex-core'
import './codex.css'

/**
 * InkRiver — el historial de ELO redibujado como RÍO DE TINTA.
 *
 * <p>La línea temporal es un trazo que se dibuja UNA vez al entrar su pliego
 * al viewport (stroke-dashoffset 700ms, `pathLength=1` → sin getTotalLength),
 * con un sangrado pre-pintado (path grueso que solo atenúa opacity, jamás
 * blur). Los hitos (entradas a top-10, rachas, pico) se estampan como sellos
 * miniatura en la orilla, en cadencia. El punto final late con un halo de
 * opacidad pausado fuera de viewport y con la pestaña oculta.
 *
 * <p>HONESTO: sin datos suficientes pinta el río SECO (空), nunca una línea
 * inventada. Lleva tabla `sr-only` equivalente para lectores de pantalla.
 *
 * <p>reduced-motion: trazo pintado completo, hitos sin cadencia, sin halo.
 *
 * @param {object} props
 * @param {Array<{fecha:string, votos:number, evento?:string, rachaLen?:number}>}
 *   props.historial  Serie de /api/personajes/:slug/elo-history (shape actual:
 *   un punto por día con `fecha` ISO y `votos` acumulados; `evento` opcional
 *   marca hitos). < 2 puntos ⇒ río seco.
 * @param {string} [props.nombre]  Nombre del personaje (copy del estado seco).
 * @param {boolean} [props.calm=false]  Fuerza el camino reduced-motion (el
 *   panel de director de la demo lo activa; en prod lo decide la media query).
 * @returns {JSX.Element|null}
 */
export default function InkRiver({ historial, nombre = 'Este personaje', calm = false }) {
  const uid = useId().replace(/:/g, '')
  const hitosDef = useMemo(() => mapearHitos(historial), [historial])
  const geo = useMemo(() => geometriaRio(historial, hitosDef), [historial, hitosDef])

  const wrapRef = useRef(null)
  const lineRef = useRef(null)
  const haloRef = useRef(null)
  const hitoRefs = useRef([])
  const drawnRef = useRef(false)
  // ¿El río está intersecando el viewport ahora mismo? Lo mantiene el IO; lo
  // consulta onVis para no reanudar el halo offscreen al volver la pestaña.
  const onScreenRef = useRef(false)

  // Disparo al entrar al viewport (una pasada) + pausa del halo fuera de él y
  // con la pestaña oculta. Todo en effect: ningún ref se toca en el render.
  useEffect(() => {
    if (geo.seco) return undefined
    const el = wrapRef.current
    if (!el) return undefined

    const reduced =
      calm ||
      (typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)

    const dibujar = () => {
      if (drawnRef.current) return
      drawnRef.current = true
      const line = lineRef.current
      if (line && !reduced) line.dataset.draw = 'true'
      const arrancarHitos = () => {
        hitoRefs.current.forEach((h, i) => {
          if (!h) return
          if (reduced) {
            h.dataset.stamp = 'false'
            return
          }
          h.style.setProperty('--codex-hito-delay', `${i * GUION.riverHitoGap}ms`)
          h.dataset.stamp = 'true'
        })
        if (haloRef.current && !reduced) {
          haloRef.current.style.animationPlayState = 'running'
        }
      }
      if (reduced) arrancarHitos()
      else window.setTimeout(arrancarHitos, GUION.river + 20)
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            onScreenRef.current = true
            dibujar()
            if (haloRef.current && drawnRef.current && !reduced) {
              haloRef.current.style.animationPlayState = 'running'
            }
          } else if (haloRef.current) {
            onScreenRef.current = false
            haloRef.current.style.animationPlayState = 'paused'
          }
        })
      },
      { threshold: 0.25 },
    )
    io.observe(el)

    const onVis = () => {
      if (haloRef.current && drawnRef.current && !reduced) {
        // Al volver la pestaña solo reanudamos si el halo sigue en viewport; si
        // está offscreen permanece pausado (no reanudar loops fuera de juego).
        haloRef.current.style.animationPlayState =
          document.hidden || !onScreenRef.current ? 'paused' : 'running'
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [geo.seco, calm])

  if (geo.seco) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface text-center">
        <span
          className="font-kanji-serif text-6xl font-bold"
          style={{ color: 'color-mix(in srgb, var(--color-gold) 30%, transparent)' }}
          aria-hidden="true"
        >
          空
        </span>
        <p className="text-sm font-semibold text-fg-strong">Aún sin historial</p>
        <p className="max-w-xs text-xs text-fg-muted">
          El río está seco: {nombre} todavía no acumula votos. No dibujamos una línea que no
          existe.
        </p>
      </div>
    )
  }

  const lineId = `codex-river-line-${uid}`
  const fillId = `codex-river-fill-${uid}`
  // Días reales de la serie (geo.pts === historial), no un "30" cableado: si el
  // backend manda 14 o 90 puntos, el sr-label y la tabla deben decir la verdad.
  const dias = geo.pts.length

  return (
    <div ref={wrapRef} className="codex__river relative">
      <svg
        viewBox={`0 0 ${geo.W} ${geo.H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`Evolución de votos en ${dias} días, de ${geo.inicial} a ${geo.actual}`}
      >
        <defs>
          <linearGradient id={lineId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="70%" stopColor="var(--color-gold)" />
            <stop offset="100%" stopColor="var(--color-gold-bright)" />
          </linearGradient>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={geo.area} fill={`url(#${fillId})`} />
        {/* sangrado de tinta (solo opacity, jamás blur) */}
        <path
          d={geo.linea}
          stroke="var(--color-accent)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{ opacity: 0.12 }}
        />
        {/* pincelada principal */}
        <path
          ref={lineRef}
          className="codex__river-line"
          d={geo.linea}
          stroke={`url(#${lineId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          pathLength="1"
        />
        <circle
          ref={haloRef}
          className="codex__river-halo"
          cx={geo.last.x}
          cy={geo.last.y}
          r="9"
          fill="var(--color-gold)"
        />
        <circle cx={geo.last.x} cy={geo.last.y} r="3.5" fill="var(--color-gold)" />
      </svg>

      {/* hitos: sellos miniatura en la orilla */}
      {geo.hitos.map((h, i) => (
        <div
          key={`${h.kanji}-${i}`}
          ref={(el) => {
            hitoRefs.current[i] = el
          }}
          className="codex__hito absolute"
          style={{ left: h.leftPct, top: h.topPct }}
          title={h.label}
        >
          <span className="sr-only">{h.label}</span>
          <span
            aria-hidden="true"
            className="grid h-[30px] w-[30px] place-items-center rounded-md font-kanji-serif text-[15px] font-bold text-fg-strong"
            style={{
              background:
                'radial-gradient(circle at 50% 40%, var(--color-hanko) 60%, color-mix(in srgb, var(--color-hanko) 70%, var(--color-canvas)))',
              boxShadow: 'inset 0 0 0 1.2px color-mix(in srgb, var(--color-fg-strong) 28%, transparent)',
            }}
          >
            {h.kanji}
          </span>
        </div>
      ))}

      {/* tabla sr-only equivalente */}
      <table className="sr-only">
        <caption>Votos por día (muestreo), {dias} días</caption>
        <tbody>
          {geo.pts
            .filter((_, i) => i % 5 === 0)
            .map((p) => (
              <tr key={p.i}>
                <th scope="row">{p.fecha}</th>
                <td>{p.votos}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
