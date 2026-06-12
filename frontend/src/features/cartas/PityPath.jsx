import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './pity-path.css'

/* El camino al torii — medidor de pity de ESPECIALES (ver NOTAS-HANDOFF.md).
   Timing canónico de la pieza. Las mismas cifras viven en los @keyframes de
   index.css (bloque "pity-path"): si se toca uno, tocar AMBOS sitios. */
const WAVE_STAGGER_MS = 40 // onda: retardo por piedra
const WAVE_FLASH_MS = 240 // onda: destello de cada piedra
const WAVE_HOLD_MS = 220 // respiro entre el final de la onda y el apagado
const AFTERGLOW_MS = 2000 // rescoldo del torii; las piedras se apagan en los 600ms iniciales

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

/** Curva en S ascendente hacia el torii (arriba-dcha). Determinista: misma
 *  geometría en cada render, sin aleatoriedad (StrictMode-safe). */
function buildPath(count) {
  const pts = []
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0 : i / (count - 1)
    pts.push({
      x: 7 + t * 64 + Math.sin(t * Math.PI * 1.55) * 7, // % left
      y: 11 + t * 46, // % bottom
      s: 1.04 - t * 0.42, // escala (perspectiva)
    })
  }
  return pts
}

const formatPct = (p) =>
  `${(p * 100).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`

/* Geometría del torii: 6 rects CSS, duplicados en capa oscura y capa dorada
   pre-horneada — el encendido es SOLO cross-fade de opacity (cero filter). */
function ToriiShape() {
  return (
    <>
      <span className="pity-path__torii-kasagi"></span>
      <span className="pity-path__torii-shimaki"></span>
      <span className="pity-path__torii-gakuzuka"></span>
      <span className="pity-path__torii-nuki"></span>
      <span className="pity-path__torii-hashira pity-path__torii-hashira--l"></span>
      <span className="pity-path__torii-hashira pity-path__torii-hashira--r"></span>
    </>
  )
}

/**
 * El camino al torii — el pity de las cartas ESPECIALES, visible y honesto.
 *
 * Medidor de progreso disfrazado de paisaje: una piedra encendida por sobre
 * abierto desde la última ESPECIAL, subiendo hacia un torii dorado. El
 * componente es un ESPEJO del server: jamás cuenta aperturas en cliente —
 * solo reacciona a cambios de `pity` (se enciende la piedra nueva) y a
 * `specialEvent` (onda + reinicio ceremonial).
 *
 * Coreografía (ver NOTAS-HANDOFF.md para el timing exacto):
 *  - `pity` sube +1 → la piedra nueva se enciende (200ms, scale 1.15→1) y su
 *    voluta de niebla se aparta (cross-fade pre-horneado).
 *  - a 2 piedras de la garantía → el torii respira (2 capas, ciclo 2,4s;
 *    pausado fuera del viewport y con la pestaña oculta).
 *  - `specialEvent` nuevo → onda piedra a piedra (40ms stagger) desde la
 *    piedra actual (suerte) o desde el torii (garantía); después las piedras
 *    se apagan en fade suave y el torii guarda un rescoldo 2s. Al terminar
 *    dispara `onCeremonyEnd` — ahí el padre refresca el pity del server.
 *
 * Accesibilidad: role="progressbar" con aria-valuetext "X de Y sobres hasta
 * la especial garantizada"; odds reales siempre disponibles en un tooltip
 * accesible por focus (anti-casino: transparencia obligatoria).
 *
 * @param {object} props
 * @param {number} props.pity
 *   Sobres abiertos desde la última ESPECIAL. SIEMPRE el valor del server
 *   (payload de GET /pity o de la respuesta de abrir sobre).
 * @param {number} props.threshold
 *   Sobre en el que la ESPECIAL está garantizada. Del server; no existe un
 *   valor por defecto a propósito — no se inventa.
 * @param {number} props.baseRate
 *   Probabilidad base de ESPECIAL por sobre, en 0–1. Del server. Se muestra
 *   EXACTA en el tooltip de odds (formato es-ES, 2 decimales).
 * @param {{ id: string|number, source: 'luck'|'pity' }|null} [props.specialEvent]
 *   Señal de que acaba de caer una ESPECIAL. Un `id` nuevo dispara la
 *   ceremonia una sola vez; `source` decide el origen de la onda ('luck' =
 *   desde la piedra actual, 'pity' = desde el torii). Un evento ya presente
 *   en el primer render NO anima (es historia, no noticia).
 * @param {() => void} [props.onCeremonyEnd]
 *   Se dispara al apagarse el rescoldo. El padre debería actualizar `pity`
 *   con el valor real del server aquí (normalmente 0).
 * @param {boolean} [props.initialOddsOpen=false]
 *   Abre el tooltip de odds anclado al montar (deep-link / demo).
 * @param {boolean} [props.forceStatic=false]
 *   Fuerza la presentación estática (la de prefers-reduced-motion) sin
 *   tocar la preferencia del sistema. Útil en tests y en la demo.
 * @param {string} [props.className]
 *
 * @example
 * <PityPath
 *   pity={data.pity}
 *   threshold={data.pityThreshold}
 *   baseRate={data.specialBaseRate}
 *   specialEvent={lastReveal?.especial
 *     ? { id: lastReveal.id, source: lastReveal.porGarantia ? 'pity' : 'luck' }
 *     : null}
 *   onCeremonyEnd={refetchPity}
 * />
 */
export default function PityPath({
  pity,
  threshold,
  baseRate,
  specialEvent = null,
  onCeremonyEnd,
  initialOddsOpen = false,
  forceStatic = false,
  className = '',
}) {
  const rootRef = useRef(null)
  const tipId = useId()

  /* Piedras encendidas ANTES de montar no re-animan (inicializador puro):
     al volver a la página con pity 7, las 7 aparecen asentadas, sin pop. */
  const [initialPity] = useState(pity)

  /* Evento → ceremonia. Patrón "adjust state during render" (sin setState
     síncrono en effects, regla React Compiler de la casa). */
  const [seenEventId, setSeenEventId] = useState(specialEvent ? specialEvent.id : null)
  const [ceremony, setCeremony] = useState(null)
  if (specialEvent && specialEvent.id !== seenEventId) {
    setSeenEventId(specialEvent.id)
    setCeremony({
      id: specialEvent.id,
      source: specialEvent.source === 'pity' ? 'pity' : 'luck',
      // suerte: la onda nace en la piedra actual; garantía: nace en el torii
      origin:
        specialEvent.source === 'pity'
          ? threshold
          : Math.min(Math.max(pity - 1, 0), threshold - 1),
      stage: 'wave',
    })
  }

  /* Máquina de fases: wave → afterglow → fin. Timeouts (async), nunca
     setState síncrono en el cuerpo del effect. */
  const onEndRef = useRef(onCeremonyEnd)
  useEffect(() => {
    onEndRef.current = onCeremonyEnd
  })
  useEffect(() => {
    if (!ceremony) return undefined
    if (ceremony.stage === 'wave') {
      const total = threshold * WAVE_STAGGER_MS + WAVE_FLASH_MS + WAVE_HOLD_MS
      const t = setTimeout(() => {
        setCeremony((c) => (c && c.stage === 'wave' ? { ...c, stage: 'afterglow' } : c))
      }, total)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setCeremony(null)
      if (onEndRef.current) onEndRef.current()
    }, AFTERGLOW_MS)
    return () => clearTimeout(t)
  }, [ceremony, threshold])

  /* Pausa de loops: fuera del viewport o con la pestaña oculta, la clase
     --asleep congela TODA animación (respiración del torii, brumas). */
  const [asleep, setAsleep] = useState(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    let inView = true
    let tabVisible = !document.hidden
    const update = () => setAsleep(!(inView && tabVisible))
    const io = new IntersectionObserver((entries) => {
      inView = entries[0] ? entries[0].isIntersecting : true
      update()
    })
    io.observe(el)
    const onVis = () => {
      tabVisible = !document.hidden
      update()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  /* Compacto (390px): el paisaje se pliega a fila horizontal. Por ancho de
     CONTENEDOR (ResizeObserver), no de viewport — funciona en cualquier slot. */
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const ro = new ResizeObserver((entries) => {
      const w = entries[0] ? entries[0].contentRect.width : 0
      setCompact(w > 0 && w < 520)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* Tooltip de odds: hover/focus lo muestran, click lo ancla, Escape cierra.
     El contenido vive SIEMPRE en el DOM (aria-describedby legible). */
  const [oddsPinned, setOddsPinned] = useState(initialOddsOpen)
  const [oddsHover, setOddsHover] = useState(false)
  const oddsOpen = oddsPinned || oddsHover

  const stones = useMemo(() => buildPath(threshold), [threshold])
  const clampedPity = Math.min(Math.max(pity, 0), threshold)
  const remaining = threshold - clampedPity
  const breathing = !ceremony && clampedPity < threshold && remaining <= 2

  const statusText = ceremony
    ? ceremony.source === 'pity'
      ? 'ESPECIAL garantizada — el camino se reinicia'
      : 'ESPECIAL por suerte — el camino se reinicia'
    : remaining === 1
      ? 'el siguiente sobre trae la ESPECIAL garantizada'
      : `faltan ${remaining} sobres para la garantía`

  const wave = ceremony && ceremony.stage === 'wave'
  const toriiDelay = wave ? Math.abs(threshold - ceremony.origin) * WAVE_STAGGER_MS : 0

  return (
    <section
      ref={rootRef}
      className={cx(
        'pity-path',
        compact && 'pity-path--compact',
        asleep && 'pity-path--asleep',
        breathing && 'pity-path--breathing',
        ceremony && `pity-path--${ceremony.stage}`,
        forceStatic && 'pity-path--static',
        className,
      )}
      aria-label="Camino a la ESPECIAL garantizada"
    >
      <header className="pity-path__head">
        <p className="pity-path__count" aria-hidden="true">
          <span key={clampedPity} className="pity-path__count-num">{clampedPity}</span>
          <span className="pity-path__count-sep">/</span>
          <span className="pity-path__count-max">{threshold}</span>
        </p>
        <div className="pity-path__copy">
          <p className="pity-path__label">
            sobres desde la última <strong>ESPECIAL</strong>
          </p>
          <p className="pity-path__status" aria-live="polite">{statusText}</p>
        </div>
        <div className="pity-path__odds">
          <button
            type="button"
            className="pity-path__odds-btn"
            aria-expanded={oddsOpen}
            aria-describedby={tipId}
            onClick={() => setOddsPinned((v) => !v)}
            onMouseEnter={() => setOddsHover(true)}
            onMouseLeave={() => setOddsHover(false)}
            onFocus={() => setOddsHover(true)}
            onBlur={() => {
              setOddsHover(false)
              setOddsPinned(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOddsHover(false)
                setOddsPinned(false)
              }
            }}
          >
            <span className="pity-path__odds-kanji" aria-hidden="true">確</span>
            odds
          </button>
          <div role="tooltip" id={tipId} className="pity-path__odds-tip" data-open={oddsOpen ? 'true' : undefined}>
            <dl className="pity-path__odds-rows">
              <div className="pity-path__odds-row">
                <dt>P(ESPECIAL) por sobre</dt>
                <dd>{formatPct(baseRate)}</dd>
              </div>
              <div className="pity-path__odds-row">
                <dt>garantía</dt>
                <dd>sobre nº {threshold}</dd>
              </div>
              <div className="pity-path__odds-row">
                <dt>abiertos sin especial</dt>
                <dd>{clampedPity}</dd>
              </div>
            </dl>
            <p className="pity-path__odds-foot">Datos del servidor — el cliente nunca cuenta aperturas.</p>
          </div>
        </div>
      </header>

      <div
        className="pity-path__scene"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={clampedPity}
        aria-valuetext={`${clampedPity} de ${threshold} sobres hasta la especial garantizada`}
      >
        <span className="pity-path__kanji" aria-hidden="true">道</span>
        <span className="pity-path__haze pity-path__haze--a" aria-hidden="true"></span>
        <span className="pity-path__haze pity-path__haze--b" aria-hidden="true"></span>
        <ol className="pity-path__stones" aria-hidden="true">
          {stones.map((p, i) => {
            const lit = i < clampedPity
            const delay = wave ? Math.abs(i - ceremony.origin) * WAVE_STAGGER_MS : 0
            return (
              <li
                key={i}
                className={cx('pity-path__stone', lit && 'is-lit', lit && i >= initialPity && 'is-new')}
                style={{
                  '--x': `${p.x}%`,
                  '--y': `${p.y}%`,
                  '--s': p.s,
                  '--wd': `${delay}ms`,
                  zIndex: stones.length - i,
                }}
              >
                <span className="pity-path__stone-mist"></span>
                <span className="pity-path__stone-body">
                  <span className="pity-path__stone-base"></span>
                  <span className="pity-path__stone-lit"></span>
                  <span className="pity-path__stone-flash"></span>
                </span>
              </li>
            )
          })}
        </ol>
        <div className="pity-path__torii" aria-hidden="true" style={{ '--wd': `${toriiDelay}ms` }}>
          <span className="pity-path__torii-glow"></span>
          <span className="pity-path__torii-breath pity-path__torii-breath--a"></span>
          <span className="pity-path__torii-breath pity-path__torii-breath--b"></span>
          <span className="pity-path__torii-frame pity-path__torii-frame--dark"><ToriiShape /></span>
          <span className="pity-path__torii-frame pity-path__torii-frame--lit"><ToriiShape /></span>
        </div>
      </div>
    </section>
  )
}
