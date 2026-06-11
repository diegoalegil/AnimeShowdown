import { useEffect, useRef, useState } from 'react'
import PersonajeImg from '../../components/PersonajeImg'
import { getStatsPersonaje } from '../../lib/personajes-core'

/**
 * TaleOfTheTape — resolución cinematográfica del comparador (/comparar).
 *
 * Sustituye las tres cajitas de stats planas y el círculo "VS" estático.
 * Coreografía al resolverse la comparación (disparada por IntersectionObserver):
 *
 *   0ms     対 (KanjiVG, 7 trazos reales) se dibuja en grande sobre la costura
 *           diagonal con stroke-dashoffset y --ease-brush.
 *   250ms   Los retratos 2:3 entran a sangre desde lados opuestos, cada uno
 *           dentro de su clip diagonal (solo transform/opacity).
 *   1150ms  ELO, victorias y derrotas se pintan como barras ENFRENTADAS que
 *           crecen una contra la otra desde el eje central (scaleX con
 *           transform-origins opuestos, stagger 120ms). La barra ganadora
 *           remata con overshoot; la rival encaja un micro-retroceso.
 *           Números en odómetro mono oro (columnas translateY, cero relayout).
 *   2350ms  Un sello dorado 勝 cae sobre el retrato del favorito (overshoot +
 *           onda de opacity) y el otro lado se atenúa medio paso.
 *
 * Perf / accesibilidad:
 *   - TODO anima transform/opacity. Sin blur, sin backdrop-filter, sin SVG
 *     filters vivos. Glows = sombras estáticas pre-pintadas.
 *   - Animaciones one-shot: no hay loops que pausar fuera del viewport; el
 *     disparo es IntersectionObserver (threshold 0.35, una sola vez).
 *   - prefers-reduced-motion: la regla global de index.css colapsa las
 *     animaciones a 0.01ms y, como TODOS los estilos base ya son el estado
 *     final (las keyframes solo definen el "from"), el bloque nace resuelto:
 *     barras llenas, kanji trazado, sello estático.
 *   - Mobile-first: <640px las barras se apilan por personaje conservando el
 *     crecimiento enfrentado (A nace del borde izquierdo, B del derecho).
 *   - Cero libs nuevas: ni framer-motion en este árbol (CSS puro), ni deps.
 *   - Honestidad de datos: getStatsPersonaje() es sintético → etiquetas
 *     "ELO base", "Victorias est.", "Derrotas est." (regla del sistema).
 *
 * Trazos de 対: KanjiVG (http://kanjivg.tagaini.net, CC BY-SA 3.0) — añadir
 * TAI_STROKES a lib/kanjiStrokes.js si se quiere reutilizar vía <KanjiStroke>.
 *
 */

// KanjiVG 05bfe (対) — orden oficial de trazos, viewBox 109x109. CC BY-SA 3.0.
const TAI_STROKES = [
  'M33.81,16c1.1,1.09,1.81,2.38,1.81,3.99c0,4.01-0.02,10.94-0.08,13.82',
  'M13.25,37.54c1.75,0.46,3.56,0.44,5.51,0.1C27.5,36.12,40.5,34,46.99,33.02c1.74-0.26,3.76-0.27,5.26-0.02',
  'M41.84,41.31c0.35,1.04,0.5,2.3-0.08,4.2c-5.01,16.62-15.13,32.87-27.88,42.24',
  'M21.21,52.76C31.25,58.5,43.07,72.34,48.25,81',
  'M54.38,43.11c1.58,0.53,4.51,0.53,6.07,0.28c7.3-1.15,25.05-4.48,31.14-4.62c2.64-0.06,4.22-0.08,5.54,0.19',
  'M78.52,13.08c1.33,1.33,2.01,2.92,2.01,5.02c0,14.56-0.01,66.41-0.01,71.37c0,9.41-4.52,3.66-7.21,1',
  'M56.25,59.12c3.07,1.54,7.94,6.34,8.71,8.74',
]

// Timeline (ms) — única fuente de verdad de la coreografía.
const T = {
  portraits: 250,
  names: 650,
  seam: 700,
  panel: 950,
  rows: [1150, 1270, 1390], // stagger 120ms
  summary: 1900,
  seal: 2350,
  dim: 2480,
  ripple: 2520,
}

const EASE_LIFT = 'cubic-bezier(0.16, 1, 0.3, 1)'

/** Dispara una sola vez al 35% de visibilidad. */
function useInViewOnce(threshold = 0.35) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || inView) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      queueMicrotask(() => setInView(true))
      return undefined
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView, threshold])
  return [ref, inView]
}

/** Canal "R G B" para las custom props de wash/costura (como Combate Estelar). */
function rgbChannel(personaje, fallback) {
  const hex = personaje?.imagenColorDominante
  if (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) {
    return `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`
  }
  return fallback
}

/**
 * Odómetro mono oro: cada dígito es una columna 0-9 que rueda con translateY
 * (em → cero relayout, cero re-paint de texto). La animación totb-roll solo
 * define el "from"; el destino es el transform base → reduced-motion y el
 * estado ya-resuelto son gratis.
 */
function Odometro({ value, on, winner, delay, className = '' }) {
  const digits = String(value).split('')
  return (
    <span
      aria-label={String(value)}
      className={`inline-flex h-[1em] overflow-hidden font-mono leading-none font-black ${
        winner ? 'text-gold-bright' : 'text-fg-muted'
      } ${className}`}
    >
      {digits.map((d, i) => (
        <span key={i} aria-hidden="true" className="block h-[1em] overflow-hidden">
          <span
            className="block"
            style={{
              transform: `translateY(${on ? -Number(d) : 0}em)`,
              animationName: on ? 'totb-roll' : 'none',
              animationDuration: '950ms',
              animationDelay: `${delay + i * 70}ms`,
              animationTimingFunction: EASE_LIFT,
              animationFillMode: 'backwards',
            }}
          >
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n} className="block h-[1em]">
                {n}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  )
}

/**
 * Barra de un lado del tape. `origin` es el borde pegado al eje central
 * (desktop) o al borde exterior propio (móvil apilado): el crecimiento
 * siempre es enfrentado.
 */
function Barra({ pct, winner, rtl, on, delay, className = '' }) {
  return (
    <div
      className={`h-2.5 sm:h-3 ${
        winner ? `totb-bar-win ${rtl ? 'totb-bar-win--rtl' : ''}` : 'totb-bar-lose'
      } ${className}`}
      style={{
        width: `${pct}%`,
        transform: `scaleX(${on ? 1 : 0})`,
        transformOrigin: rtl ? '100% 50%' : '0% 50%',
        animationName: on ? (winner ? 'totb-grow-win' : 'totb-grow-lose') : 'none',
        animationDuration: '900ms',
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    />
  )
}

/** Trazado del 対 sobre la costura. */
function KanjiTai({ on, className = '' }) {
  return (
    <svg
      viewBox="0 0 109 109"
      role="img"
      aria-label="対"
      lang="ja"
      className={className}
      style={{
        overflow: 'visible',
        opacity: on ? 0.34 : 0,
        animationName: on ? 'totb-kanji' : 'none',
        animationDuration: '1600ms',
        animationFillMode: 'backwards',
      }}
    >
      <g
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {TAI_STROKES.map((d, i) => (
          <path
            key={i}
            d={d}
            pathLength="1"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: on ? 0 : 1,
              animationName: on ? 'totb-stroke' : 'none',
              animationDuration: '480ms',
              animationDelay: `${i * 95}ms`,
              animationTimingFunction: 'var(--ease-brush)',
              animationFillMode: 'backwards',
            }}
          />
        ))}
      </g>
    </svg>
  )
}

/** Sello 勝 que cae sobre el favorito, con onda de opacity. */
function SelloFavorito({ on, className = '' }) {
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      <div
        className="absolute inset-0 rounded-full border-2 border-gold/70"
        style={{
          opacity: 0,
          animationName: on ? 'totb-ripple' : 'none',
          animationDuration: '750ms',
          animationDelay: `${T.ripple}ms`,
          animationTimingFunction: EASE_LIFT,
          animationFillMode: 'backwards',
        }}
      />
      <div
        className="totb-seal absolute inset-0 flex items-center justify-center rounded-full"
        style={{
          opacity: on ? 1 : 0,
          transform: 'rotate(-8deg)',
          animationName: on ? 'totb-seal' : 'none',
          animationDuration: '700ms',
          animationDelay: `${T.seal}ms`,
          animationFillMode: 'backwards',
        }}
      >
        <span
          lang="ja"
          className="text-gold-bright leading-none font-black drop-shadow-scrim text-[1.7em]"
          style={{ fontFamily: 'var(--font-kanji-serif)' }}
        >
          勝
        </span>
      </div>
    </div>
  )
}

/**
 * @param {{ personajeA: object, personajeB: object }} props
 *   Objetos del catálogo (usePersonajesCatalogo). El componente calcula las
 *   stats sintéticas y resuelve favorito y ganador por stat.
 */
function TaleOfTheTape({ personajeA, personajeB }) {
  const [stageRef, resuelto] = useInViewOnce()

  const statsA = getStatsPersonaje(personajeA.slug)
  const statsB = getStatsPersonaje(personajeB.slug)
  const favoritoEsB = statsB.elo >= statsA.elo
  const diferencia = Math.abs(statsA.elo - statsB.elo)
  const favorito = favoritoEsB ? personajeB : personajeA

  // Filas del tape. pct escala cada barra contra el mejor del par; en ELO se
  // resta el suelo 1500 para que la diferencia se lea (2107 vs 2197 serían
  // dos barras casi idénticas). En derrotas gana quien MENOS tiene: la barra
  // dorada corta + el odómetro oro cuentan la historia.
  const eloFloor = 1500
  const filas = [
    {
      label: 'ELO base',
      a: statsA.elo,
      b: statsB.elo,
      pctA: ((statsA.elo - eloFloor) / (Math.max(statsA.elo, statsB.elo) - eloFloor)) * 100,
      pctB: ((statsB.elo - eloFloor) / (Math.max(statsA.elo, statsB.elo) - eloFloor)) * 100,
      ganaB: statsB.elo >= statsA.elo,
    },
    {
      label: 'Victorias est.',
      a: statsA.wins,
      b: statsB.wins,
      pctA: (statsA.wins / Math.max(statsA.wins, statsB.wins)) * 100,
      pctB: (statsB.wins / Math.max(statsA.wins, statsB.wins)) * 100,
      ganaB: statsB.wins >= statsA.wins,
    },
    {
      label: 'Derrotas est.',
      a: statsA.losses,
      b: statsB.losses,
      pctA: (statsA.losses / Math.max(statsA.losses, statsB.losses)) * 100,
      pctB: (statsB.losses / Math.max(statsA.losses, statsB.losses)) * 100,
      ganaB: statsB.losses <= statsA.losses,
    },
  ]

  const on = resuelto
  const fadeIn = (delay, name = 'totb-fade') => ({
    opacity: on ? 1 : 0,
    animationName: on ? name : 'none',
    animationDuration: '600ms',
    animationDelay: `${delay}ms`,
    animationTimingFunction: EASE_LIFT,
    animationFillMode: 'backwards',
  })

  return (
    <section
      ref={stageRef}
      data-comment-anchor="comparar-tale-of-the-tape"
      aria-label={`Tale of the tape: ${personajeA.nombre} contra ${personajeB.nombre}`}
      className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-bg shadow-elev-2"
      style={{
        '--totb-rgb-a': rgbChannel(personajeA, '159 29 44'),
        '--totb-rgb-b': rgbChannel(personajeB, '197 161 90'),
      }}
    >
      {/* ===== Banda de retratos (móvil) / escena completa (sm+) ===== */}
      <div className="relative h-72 sm:h-[600px]">
        {/* Retrato A — entra desde la izquierda dentro de su clip diagonal */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] [clip-path:polygon(0_0,62%_0,38%_100%,0_100%)] sm:[clip-path:polygon(0_0,58%_0,42%_100%,0_100%)]"
          style={{
            opacity: on ? 1 : 0,
            animationName: on ? 'totb-port-l' : 'none',
            animationDuration: '700ms',
            animationDelay: `${T.portraits}ms`,
            animationTimingFunction: EASE_LIFT,
            animationFillMode: 'backwards',
          }}
        >
          <PersonajeImg
            slug={personajeA.slug}
            alt={personajeA.nombre}
            className="absolute top-0 left-0 h-full w-[62%] sm:w-[58%]"
            fit="cover"
            position="top"
            sizes="(min-width: 640px) 640px, 280px"
            maxSourceWidth={1024}
          />
          <div className="totb-wash-l absolute inset-0" />
        </div>

        {/* Retrato B — entra desde la derecha */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] [clip-path:polygon(62%_0,100%_0,100%_100%,38%_100%)] sm:[clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]"
          style={{
            opacity: on ? 1 : 0,
            animationName: on ? 'totb-port-r' : 'none',
            animationDuration: '700ms',
            animationDelay: `${T.portraits}ms`,
            animationTimingFunction: EASE_LIFT,
            animationFillMode: 'backwards',
          }}
        >
          <PersonajeImg
            slug={personajeB.slug}
            alt={personajeB.nombre}
            className="absolute top-0 right-0 h-full w-[62%] sm:w-[58%]"
            fit="cover"
            position="top"
            sizes="(min-width: 640px) 640px, 280px"
            maxSourceWidth={1024}
          />
          <div className="totb-wash-r absolute inset-0" />
        </div>

        {/* Costura diagonal */}
        <div
          className="totb-seam pointer-events-none absolute inset-0 z-[2] [clip-path:polygon(61.4%_0,62.6%_0,38.6%_100%,37.4%_100%)] sm:[clip-path:polygon(57.65%_0,58.35%_0,42.35%_100%,41.65%_100%)]"
          style={fadeIn(T.seam)}
        />

        {/* Scrim de legibilidad solo bajo el texto (sm+: el panel vive dentro de la escena) */}
        <div className="totb-scrim pointer-events-none absolute inset-0 z-[3] max-sm:hidden" />

        {/* Atenuación de medio paso del no-favorito */}
        <div
          className={`pointer-events-none absolute inset-0 z-[4] bg-bg ${
            favoritoEsB
              ? '[clip-path:polygon(0_0,62%_0,38%_100%,0_100%)] sm:[clip-path:polygon(0_0,58%_0,42%_100%,0_100%)]'
              : '[clip-path:polygon(62%_0,100%_0,100%_100%,38%_100%)] sm:[clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]'
          }`}
          style={{
            opacity: on ? 0.45 : 0,
            animationName: on ? 'totb-fade' : 'none',
            animationDuration: '500ms',
            animationDelay: `${T.dim}ms`,
            animationFillMode: 'backwards',
          }}
        />

        {/* Nombres (sm+ dentro de la escena) */}
        <div
          className="absolute top-5 left-6 z-[5] flex-col gap-0.5 max-sm:hidden sm:flex"
          style={fadeIn(T.names, 'totb-rise')}
        >
          <span className="text-2xl font-black tracking-tight text-fg-strong text-shadow-scrim">
            {personajeA.nombre}
          </span>
          <span className="text-[13px] font-semibold text-fg-muted text-shadow-scrim">
            {personajeA.anime}
          </span>
        </div>
        <div
          className="absolute top-5 right-6 z-[5] flex-col items-end gap-0.5 max-sm:hidden sm:flex"
          style={fadeIn(T.names, 'totb-rise')}
        >
          <span className="text-2xl font-black tracking-tight text-fg-strong text-shadow-scrim">
            {personajeB.nombre}
          </span>
          <span className="text-[13px] font-semibold text-fg-muted text-shadow-scrim">
            {personajeB.anime}
          </span>
        </div>

        {/* 対 dibujándose sobre la costura */}
        <KanjiTai
          on={on}
          className="absolute top-[46%] left-1/2 z-[6] w-32 -translate-x-1/2 -translate-y-1/2 sm:top-[35%] sm:w-80"
        />

        {/* Sello dorado sobre el favorito */}
        <SelloFavorito
          on={on}
          className={`absolute z-[8] h-14 w-14 text-[28px] sm:h-24 sm:w-24 sm:text-[46px] ${
            favoritoEsB ? 'top-[12%] right-[8%] sm:top-[17%] sm:right-[13%]' : 'top-[12%] left-[8%] sm:top-[17%] sm:left-[13%]'
          }`}
        />

        {/* ===== Panel de barras enfrentadas (sm+: dentro de la escena) ===== */}
        <div
          className="absolute bottom-6 left-1/2 z-[7] w-[min(680px,86%)] -translate-x-1/2 flex-col gap-4 max-sm:hidden sm:flex"
          style={fadeIn(T.panel, 'totb-rise')}
        >
          {filas.map((fila, i) => (
            <div key={fila.label} className="flex flex-col gap-1.5">
              <p className="text-center text-[11px] font-bold text-fg-muted">{fila.label}</p>
              <div className="grid grid-cols-[76px_1fr_76px] items-center gap-3">
                <div className="flex justify-start text-[21px]">
                  <Odometro value={fila.a} on={on} winner={!fila.ganaB} delay={T.rows[i]} />
                </div>
                {/* Eje central: las dos barras nacen pegadas a él, con
                    transform-origins opuestos — crecen una contra la otra. */}
                <div className="grid grid-cols-[1fr_2px_1fr] items-center">
                  <div className="flex justify-end">
                    <Barra
                      pct={fila.pctA}
                      winner={!fila.ganaB}
                      rtl
                      on={on}
                      delay={T.rows[i]}
                      className="rounded-l-[3px]"
                    />
                  </div>
                  <div className="h-5 bg-gold/50" />
                  <div className="flex justify-start">
                    <Barra
                      pct={fila.pctB}
                      winner={fila.ganaB}
                      on={on}
                      delay={T.rows[i]}
                      className="rounded-r-[3px]"
                    />
                  </div>
                </div>
                <div className="flex justify-end text-[21px]">
                  <Odometro value={fila.b} on={on} winner={fila.ganaB} delay={T.rows[i]} />
                </div>
              </div>
            </div>
          ))}
          <p className="mt-0.5 text-center text-[12.5px] text-fg-muted" style={fadeIn(T.summary)}>
            {favorito.nombre} llega con{' '}
            <span className="font-mono font-black text-gold-bright">+{diferencia}</span> de ventaja
            ELO base · récord estimado del catálogo
          </p>
        </div>
      </div>

      {/* ===== Móvil: nombres + barras apiladas conservando el enfrentamiento ===== */}
      <div className="sm:hidden">
        <div
          className="flex items-baseline justify-between gap-3 px-4 pt-3.5"
          style={fadeIn(T.names, 'totb-rise')}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-base font-black tracking-tight text-fg-strong">
              {personajeA.nombre}
            </span>
            <span className="text-[11px] font-semibold text-fg-muted">{personajeA.anime}</span>
          </div>
          <div className="flex min-w-0 flex-col items-end gap-0.5">
            <span className="truncate text-base font-black tracking-tight text-fg-strong">
              {personajeB.nombre}
            </span>
            <span className="text-[11px] font-semibold text-fg-muted">{personajeB.anime}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 pt-4 pb-5" style={fadeIn(T.panel, 'totb-rise')}>
          {filas.map((fila, i) => (
            <div key={fila.label} className="flex flex-col gap-1">
              <p className="text-center text-[10.5px] font-bold text-fg-muted">{fila.label}</p>
              {/* A nace del borde izquierdo y crece hacia la derecha… */}
              <div className="grid grid-cols-[52px_1fr] items-center gap-2">
                <div className="flex justify-start text-[15px]">
                  <Odometro value={fila.a} on={on} winner={!fila.ganaB} delay={T.rows[i]} />
                </div>
                <div className="flex justify-start">
                  <Barra
                    pct={fila.pctA}
                    winner={!fila.ganaB}
                    on={on}
                    delay={T.rows[i]}
                    className="rounded-r-[3px]"
                  />
                </div>
              </div>
              {/* …y B del derecho hacia la izquierda: crecimiento enfrentado. */}
              <div className="grid grid-cols-[1fr_52px] items-center gap-2">
                <div className="flex justify-end">
                  <Barra
                    pct={fila.pctB}
                    winner={fila.ganaB}
                    rtl
                    on={on}
                    delay={T.rows[i]}
                    className="rounded-l-[3px]"
                  />
                </div>
                <div className="flex justify-end text-[15px]">
                  <Odometro value={fila.b} on={on} winner={fila.ganaB} delay={T.rows[i]} />
                </div>
              </div>
            </div>
          ))}
          <p className="text-center text-[11.5px] text-fg-muted" style={fadeIn(T.summary)}>
            {favorito.nombre} llega con{' '}
            <span className="font-mono font-black text-gold-bright">+{diferencia}</span> ELO base ·
            récord estimado
          </p>
        </div>
      </div>
    </section>
  )
}

export default TaleOfTheTape
