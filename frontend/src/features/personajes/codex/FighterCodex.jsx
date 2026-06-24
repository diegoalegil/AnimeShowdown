import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
// Ajusta la profundidad de estos imports a la ubicación real del archivo.
// Asumido: src/features/personajes/codex/FighterCodex.jsx
import PersonajeImg from '../../../components/PersonajeImg'
import { adoptPersonajeHero, releasePersonajeHero } from '../../../lib/viewTransitions'
import { useSoundOptional } from '../../../contexts/SoundContext'
import CodexPleat, { CodexBookmark } from './CodexPleat'
import InkRiver from './InkRiver'
import FacingPages from './FacingPages'
import {
  GUION,
  PLIEGOS,
  cadenciaSellos,
  direccionPliego,
  consumirSkipEntrance,
  prefiereCalma,
} from './codex-core'
import './codex.css'

/** Metadatos de los marcapáginas, en el orden canónico de PLIEGOS. */
const PLEAT_META = {
  stats: { kanji: '戦', title: 'Stats' },
  rio: { kanji: '史', title: 'Río de tinta' },
  matchups: { kanji: '対', title: 'Matchups' },
  votos: { kanji: '炎', title: 'Votos' },
}

/**
 * FighterCodex — la cabecera de /personajes/:slug como LIBRO CEREMONIAL.
 *
 * <p>La CUBIERTA (arte a sangre + kanji de universo lacado) se ABRE como página
 * (rotateY en un nodo 3D sin filtros, backface correcto) revelando el
 * FRONTISPICIO: nombre trazado, universo en furigana y los TRES SELLOS DE
 * ESTADO (ELO acuñado · puesto global · % victorias) estampados en cadencia. El
 * cuerpo se reorganiza en PLIEGOS con marcapáginas de tela (tabs verticales con
 * kanji; horizontales arriba en 390px). El historial de ELO es un InkRiver y
 * los matchups, FacingPages.
 *
 * <p>La apertura corre UNA vez por visita de sesión (skipEntrance); las
 * re-entradas muestran el códice abierto sin coreografía. La cubierta es el
 * destino del morph compartido personaje-hero: la apertura espera a que el
 * morph asiente ({@link GUION}.morphSettle) antes de girar.
 *
 * <p>React 19 / Compiler: ningún ref se lee/escribe en el render (solo en
 * effects/timers); ningún setState síncrono en el cuerpo de un effect (la
 * coreografía vive en timers). Variación visual determinista.
 *
 * @param {object} props
 * @param {{slug:string, nombre:string, anime:string, imagenColorDominante?:string}}
 *   props.personaje  Shape actual del catálogo (lib/personajes-core).
 * @param {{elo:number, wins:number, losses:number}} props.stats  getStatsPersonaje(slug).
 * @param {number} props.rankGlobal  Puesto en el archivo (ELO base).
 * @param {number} props.rankAnime   Puesto dentro de su universo.
 * @param {number} props.totalAnime  Personajes del universo.
 * @param {number} props.totalCatalogo  Tamaño del catálogo.
 * @param {string} [props.universoKanji]  Kanji REAL del universo (visualAnime.identity.kanji).
 *   Sin kanji con significado → la cubierta no laquea glifo (nunca relleno).
 * @param {string} [props.furigana]  Lectura del universo (anotación furigana).
 * @param {string} [props.numero]    Nº de archivo, p. ej. "003".
 * @param {Array} [props.historial]  Serie /elo-history para InkRiver.
 * @param {Array} [props.matchups]   Agregado /matchups para FacingPages.
 * @param {{votosPeriodoActual:number, votosPeriodoAnterior:number, delta:number}} [props.votosPeriodo]
 * @param {boolean} [props.skipEntrance]  Forzar abierto sin coreografía. Si se
 *   omite, se decide con el gate de sesión (consumirSkipEntrance).
 * @param {()=>void} [props.onRetar]  CTA "retar" (→ /votar).
 * @returns {JSX.Element}
 */
export default function FighterCodex({
  personaje,
  stats,
  rankGlobal,
  rankAnime,
  totalAnime,
  universoKanji,
  furigana,
  numero,
  historial = [],
  matchups = [],
  votosPeriodo,
  skipEntrance,
  onRetar,
}) {
  const uid = useId().replace(/:/g, '')
  const { play } = useSoundOptional()
  const [activePleat, setActivePleat] = useState('stats')
  // Orientación real del tablist: vertical en ≥sm (marcapáginas en columna),
  // horizontal en móvil (fila arriba). aria-orientation debe coincidir con el
  // eje real para no engañar al lector de pantalla (onTabKey maneja ambos ejes).
  const [tabOrientation, setTabOrientation] = useState('vertical')
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia('(min-width: 640px)')
    const sync = () => setTabOrientation(mq.matches ? 'vertical' : 'horizontal')
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const rootRef = useRef(null)
  const heroMorphRef = useRef(null)
  const coverRef = useRef(null)
  const nameRef = useRef(null)
  const riseRefs = useRef([])
  const sealRefs = useRef([])
  const bookmarkRefs = useRef({})
  const panelRef = useRef(null)
  const switchTimers = useRef([])

  const total = stats.wins + stats.losses
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : null

  // -- morph compartido personaje-hero: la cubierta ES el destino del morph.
  //    Layout effect para que el view-transition-name esté puesto al capturar.
  useLayoutEffect(() => {
    const el = heroMorphRef.current
    adoptPersonajeHero(el)
    return () => releasePersonajeHero(el)
  }, [personaje.slug])

  // -- apertura: una vez por sesión; espera al asiento del morph antes de girar.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const reduced = prefiereCalma()
    const skip = skipEntrance ?? consumirSkipEntrance(personaje.slug)
    const timers = []
    const push = (ms, fn) => timers.push(window.setTimeout(fn, ms))

    const abrirDirecto = () => {
      if (coverRef.current) coverRef.current.dataset.open = 'true'
    }

    if (skip || reduced) {
      // Re-entrada / reduced-motion: abierto de inicio, sin cadencia.
      root.classList.remove('codex--play')
      abrirDirecto()
      return () => timers.forEach(clearTimeout)
    }

    // Coreografía completa.
    root.classList.add('codex--play')
    // 1) el morph asienta, luego gira la cubierta (650ms ease-lift).
    push(GUION.morphSettle, () => {
      if (coverRef.current) coverRef.current.dataset.open = 'true'
      play('playWhoosh')
    })
    // 2) frontispicio: nombre + líneas (tras abrir).
    push(GUION.morphSettle + GUION.cover, () => {
      if (nameRef.current) nameRef.current.dataset.trace = 'true'
      riseRefs.current.forEach((el, i) => {
        if (!el) return
        el.style.setProperty('animation-delay', `${i * 80}ms`)
        el.dataset.rise = 'true'
      })
    })
    // 3) sellos en cadencia (verdict SOLO en el primero).
    const baseSeal = GUION.morphSettle + GUION.cover
    cadenciaSellos(3).forEach(({ index, delay, verdict }) => {
      push(baseSeal + delay, () => {
        const el = sealRefs.current[index]
        if (el) {
          el.style.setProperty('--codex-seal-delay', '0ms')
          el.dataset.stamp = 'true'
        }
        if (verdict) play('playVerdictStamp')
        else play('playSello')
      })
    })
    // 4) marcapáginas entran con stagger 60ms.
    push(GUION.morphSettle + GUION.bookmarks, () => {
      PLIEGOS.forEach((key, i) => {
        const el = bookmarkRefs.current[key]
        if (el) {
          el.style.setProperty('--codex-bm-delay', `${i * GUION.bookmarkGap}ms`)
          el.dataset.enter = 'true'
        }
      })
    })

    return () => timers.forEach(clearTimeout)
    // play fuera de deps a proposito: efecto one-shot de la ceremonia de apertura;
    // re-ejecutarlo al togglear mute repetiria la animacion. El mute se gatea
    // dentro de play().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaje.slug, skipEntrance])

  // -- cambio de pliego: cierre hacia el marcapáginas + apertura del nuevo,
  //    encadenados (300 + 350ms ease-brush). Sin scroll-jump (alto reservado).
  const selectPleat = useCallback(
    (key, { focusPanel = true } = {}) => {
      if (key === activePleat) return
      switchTimers.current.forEach(clearTimeout)
      switchTimers.current = []
      const reduced = prefiereCalma()
      const { closeOrigin, openOrigin } = direccionPliego(activePleat, key)
      play('playClack')
      const panel = panelRef.current

      if (reduced || !panel) {
        setActivePleat(key)
        // focusPanel=false en navegación por flechas: el foco roving se queda en
        // el tab (lo mueve onTabKey); si no, el panel lo robaría (rompe APG).
        if (focusPanel) {
          switchTimers.current.push(
            window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 16),
          )
        }
        return
      }

      panel.style.transformOrigin = closeOrigin
      panel.dataset.phase = 'closing'
      switchTimers.current.push(
        window.setTimeout(() => {
          setActivePleat(key)
          switchTimers.current.push(
            window.setTimeout(() => {
              const p = panelRef.current
              if (p) {
                p.style.transformOrigin = openOrigin
                p.dataset.phase = 'opening'
                if (focusPanel) p.focus({ preventScroll: true })
                switchTimers.current.push(
                  window.setTimeout(() => {
                    if (p) p.dataset.phase = ''
                  }, GUION.pleatOpen + 20),
                )
              }
            }, 16),
          )
        }, GUION.pleatClose),
      )
    },
    [activePleat, play],
  )

  useEffect(() => () => switchTimers.current.forEach(clearTimeout), [])

  const onTabKey = useCallback(
    (e) => {
      let i = PLIEGOS.indexOf(activePleat)
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        i = (i + 1) % PLIEGOS.length
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        i = (i - 1 + PLIEGOS.length) % PLIEGOS.length
      } else if (e.key === 'Home') {
        e.preventDefault()
        i = 0
      } else if (e.key === 'End') {
        e.preventDefault()
        i = PLIEGOS.length - 1
      } else {
        return
      }
      const key = PLIEGOS[i]
      selectPleat(key, { focusPanel: false })
      // Registrar el timer en switchTimers para que el cleanup del effect de
      // desmontaje (más abajo) lo cancele y no se ejecute sobre un ref ya nulo.
      switchTimers.current.push(
        window.setTimeout(() => bookmarkRefs.current[key]?.focus(), 20),
      )
    },
    [activePleat, selectPleat],
  )

  // ELO/wins/losses son SINTÉTICOS (getStatsPersonaje, _sintetico) y rankGlobal
  // ordena el catálogo por ese ELO base — NO es el ranking competitivo de
  // /ranking. La regla de honestidad del módulo exige etiquetar base/estimado:
  // los sellos llevan el calificador (igual que la badge y la StatsPleat).
  const seals = [
    { kanji: '印', label: 'ELO base', value: String(stats.elo), sr: `ELO base estimado ${stats.elo}` },
    {
      kanji: '番付',
      label: 'Puesto · catálogo',
      value: `#${rankGlobal}`,
      sr: `${rankGlobal}º en el ranking del catálogo (por ELO base estimado; el ranking competitivo real vive en /ranking)`,
    },
    {
      kanji: '勝',
      label: '% victorias est.',
      value: winRate == null ? '—' : `${winRate}%`,
      sr: winRate == null ? 'sin clasificar aún' : `${winRate}% de victorias (estimado)`,
    },
  ]
  const tintColor = personaje.imagenColorDominante || 'var(--color-accent)'

  return (
    <article ref={rootRef} className="codex" itemScope itemType="https://schema.org/Person">
      <meta itemProp="url" content={`https://animeshowdown.dev/personajes/${personaje.slug}`} />

      {/* ===================== HERO: frontispicio + cubierta ===================== */}
      <div ref={heroMorphRef} className="codex__hero h-[clamp(420px,70vh,520px)]">
        {/* FRONTISPICIO (debajo, revelado al abrir) */}
        <div className="absolute inset-0 flex flex-col justify-between overflow-hidden bg-surface-alt p-[clamp(20px,4vw,40px)]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[14%] -right-[2%] font-display text-[clamp(13rem,30vw,22rem)] font-black leading-none"
            style={{ color: 'color-mix(in srgb, var(--color-gold) 5%, transparent)' }}
          >
            {universoKanji}
          </span>

          <div ref={(el) => (riseRefs.current[0] = el)} className="codex__rise flex items-center gap-3">
            <span className="inline-flex items-center gap-2.5 font-mono text-xs text-gold">
              <span className="h-px w-5 bg-border-gold" />
              {personaje.anime}
            </span>
            {numero && <span className="font-mono text-[11px] text-fg-muted">Nº {numero}</span>}
          </div>

          <div className="relative">
            {furigana && (
              <p ref={(el) => (riseRefs.current[1] = el)} className="codex__rise m-0 mb-1.5 font-kanji-serif text-[13px] text-fg-muted">
                {furigana}
              </p>
            )}
            <h1 ref={nameRef} itemProp="name" className="codex__name m-0 font-display text-[clamp(2rem,6vw,3.4rem)] font-bold leading-[1.04] text-fg-strong">
              {personaje.nombre}
            </h1>
            <div className="mt-3.5 h-px w-full max-w-[340px] bg-[linear-gradient(90deg,var(--color-border-gold),transparent_82%)]" aria-hidden="true" />
          </div>

          {/* TRES SELLOS DE ESTADO */}
          <div role="group" aria-label={`Estado de combate de ${personaje.nombre}`} className="relative flex flex-wrap gap-[clamp(10px,2.4vw,20px)]">
            {seals.map((s, i) => (
              <div key={s.kanji} ref={(el) => (sealRefs.current[i] = el)} className="codex__seal">
                <span className="sr-only">{s.sr}</span>
                <div aria-hidden="true" className="flex items-center gap-3">
                  <span className="codex__seal-disc h-[clamp(46px,11vw,60px)] w-[clamp(46px,11vw,60px)] text-[clamp(22px,5.5vw,30px)]">
                    {s.kanji}
                    <span className="codex__seal-ripple" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col leading-[1.1]">
                    <span className="font-mono text-[10px] text-fg-muted">{s.label}</span>
                    <span className="font-mono text-[clamp(20px,4.6vw,27px)] font-bold tabular-nums text-elo-number">{s.value}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CUBIERTA (gira; aria-hidden, decorativa) */}
        <div ref={coverRef} className="codex__cover" aria-hidden="true">
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${tintColor} 55%, var(--color-canvas)), var(--color-canvas) 78%)` }}
          >
            <PersonajeImg
              slug={personaje.slug}
              alt=""
              loading="eager"
              sizes="(min-width: 880px) 880px, 100vw"
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 38%, color-mix(in srgb, var(--color-canvas) 78%, transparent))' }} />
            {universoKanji && (
              <span
                className="absolute right-[clamp(14px,4vw,28px)] top-[clamp(14px,4vw,28px)] font-display text-[clamp(4.5rem,15vw,9rem)] font-black leading-[0.9] text-gold"
                style={{ textShadow: '0 2px 0 color-mix(in srgb, var(--color-canvas) 60%, transparent), 0 0 50px color-mix(in srgb, var(--color-accent) 40%, transparent)' }}
              >
                {universoKanji}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-[clamp(18px,4vw,30px)]">
              <p className="m-0 font-mono text-xs text-gold">{personaje.anime}</p>
              <p className="m-0 mt-1 font-display text-[clamp(1.6rem,5vw,2.6rem)] font-bold leading-[1.05] text-fg-strong">{personaje.nombre}</p>
              <p className="m-0 mt-2.5 font-mono text-[11px] text-gold/80">Abrir el códice ›</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== PLIEGOS ===================== */}
      <div className="relative flex flex-col border-t border-border-gold-subtle sm:flex-row">
        <div
          role="tablist"
          aria-label="Pliegos de la ficha"
          aria-orientation={tabOrientation}
          className="flex flex-row gap-1.5 p-2.5 sm:w-[clamp(48px,14vw,150px)] sm:flex-none sm:flex-col sm:gap-2 sm:p-0 sm:py-4"
        >
          {PLIEGOS.map((key, i) => (
            <CodexBookmark
              key={key}
              ref={(el) => (bookmarkRefs.current[key] = el)}
              id={`codex-tab-${key}-${uid}`}
              // aria-controls SOLO en el tab seleccionado: es el único cuyo
              // tabpanel se renderiza (panel perezoso, patrón APG). Apuntar a
              // paneles inexistentes desde los tabs inactivos dejaba 3 IDREF
              // colgantes que los lectores de pantalla no podían resolver.
              controls={activePleat === key ? `codex-panel-${key}-${uid}` : undefined}
              kanji={PLEAT_META[key].kanji}
              title={PLEAT_META[key].title}
              selected={activePleat === key}
              // Móvil (orientación horizontal, <640px): tabs solo-kanji para no
              // desbordar las etiquetas bajo `.codex{overflow:hidden}`.
              compact={tabOrientation === 'horizontal'}
              enterIndex={i}
              onKeyDown={onTabKey}
              onSelect={() => selectPleat(key)}
            />
          ))}
        </div>

        <div className="relative min-h-[clamp(380px,52vh,520px)] flex-1 overflow-hidden bg-bg">
          <CodexPleat
            ref={panelRef}
            id={`codex-panel-${activePleat}-${uid}`}
            labelledBy={`codex-tab-${activePleat}-${uid}`}
          >
            {activePleat === 'stats' && (
              <StatsPleat personaje={personaje} stats={stats} rankAnime={rankAnime} totalAnime={totalAnime} winRate={winRate} total={total} />
            )}
            {activePleat === 'rio' && <InkRiver historial={historial} nombre={personaje.nombre} />}
            {activePleat === 'matchups' && (
              <FacingPages personaje={personaje} matchups={matchups} onRetar={onRetar} />
            )}
            {activePleat === 'votos' && <VotosPleat votosPeriodo={votosPeriodo} nombre={personaje.nombre} />}
          </CodexPleat>
        </div>
      </div>
    </article>
  )
}

/** Pliego de estadísticas (componente auxiliar a nivel de módulo). */
function StatsPleat({ personaje, stats, rankAnime, totalAnime, winRate, total }) {
  const cards = [
    { label: 'ELO base', value: String(stats.elo), cls: 'text-elo-number', note: 'estimado por popularidad' },
    { label: 'Victorias', value: String(stats.wins), cls: 'text-success', note: 'duelos ganados est.' },
    { label: 'Derrotas', value: String(stats.losses), cls: 'text-danger', note: 'duelos perdidos est.' },
    { label: 'Rank universo', value: `#${rankAnime}`, cls: 'text-gold', note: `de ${totalAnime} en ${personaje.anime}` },
  ]
  return (
    <div>
      <div className="mb-[18px] flex items-baseline justify-between gap-3">
        <h2 className="m-0 font-display text-[clamp(1.3rem,3.4vw,1.8rem)] font-bold text-fg-strong">Estadísticas de combate</h2>
        <span className="font-mono text-[11px] text-fg-muted">戦 · archivo</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="m-0 font-mono text-[10px] text-fg-muted">{c.label}</p>
            <p className={`m-0 mt-2 font-mono text-[28px] font-bold tabular-nums ${c.cls}`}>{c.value}</p>
            <p className="m-0 mt-1.5 text-xs text-fg-muted">{c.note}</p>
          </div>
        ))}
      </div>
      {winRate != null && (
        <p className="mt-[18px] font-mono text-[11px] text-fg-muted">win rate est. {winRate}% · {total} combates en el archivo</p>
      )}
    </div>
  )
}

/** Pliego de votos recientes (componente auxiliar a nivel de módulo). */
function VotosPleat({ votosPeriodo, nombre }) {
  const actual = votosPeriodo?.votosPeriodoActual ?? 0
  const delta = votosPeriodo?.delta ?? 0
  const subio = delta > 0
  // Formato de miles + signo limpio: antes un delta negativo salía como "– -1234"
  // (en-dash + número negativo, sin separador de miles).
  const flechaDelta = delta > 0 ? '▲' : delta < 0 ? '▼' : '–'
  const signoDelta = delta > 0 ? '+' : delta < 0 ? '−' : ''
  const deltaFmt = `${signoDelta}${Math.abs(delta).toLocaleString('es-ES')}`
  return (
    <div>
      <div className="mb-[18px] flex items-baseline justify-between gap-3">
        <h2 className="m-0 font-display text-[clamp(1.3rem,3.4vw,1.8rem)] font-bold text-fg-strong">Votos recientes</h2>
        <span className="font-mono text-[11px] text-fg-muted">炎 · 7 días</span>
      </div>
      <div className="flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-surface p-[18px]">
        <div className="min-w-[120px]">
          <p className="m-0 font-mono text-[11px] text-fg-muted">votos · últimos 7 días</p>
          <p className="m-0 mt-1.5 font-mono text-[34px] font-bold tabular-nums text-fg-strong">{actual.toLocaleString('es-ES')}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-[13px] font-bold ${subio ? 'text-success' : 'text-fg-muted'}`}>
          {flechaDelta} {deltaFmt} vs semana pasada
        </span>
      </div>
      {actual === 0 && (
        <p className="mt-3.5 text-xs text-fg-muted">{nombre} aún no recibe votos esta semana.</p>
      )}
    </div>
  )
}
