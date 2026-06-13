/**
 * PersonalDossier — «El archivo de <username>» (/mi-ranking)
 *
 * Tu ranking personal como expediente propio: sello hanko con la inicial del
 * usuario, placas finas con TU posición por personaje, cintas de movimiento
 * que comparan contra el snapshot REAL de tu última visita (localVoteRanking)
 * y contraste con el ranking global por fila (desactivable y persistente).
 *
 * CSS de feature: ./personal-dossier.css (los @keyframes viven ahí — CSP por
 * hash, cero estilos en runtime). Sin framer-motion: coreografía CSS one-shot
 * + timers. No introduce loops infinitos (nada que enganchar a as-calm).
 *
 * React 19 + Compiler:
 *  - cero lecturas/escrituras de refs en render (espejo de entries vía effect);
 *  - cero setState síncrono en cuerpos de effect (lecturas de storage en rAF;
 *    coreografía en callbacks de setTimeout/IntersectionObserver);
 *  - cero Date.now()/Math.random() en render (solo en callbacks/cleanup).
 *
 * @typedef {Object} DossierEntry
 * @property {string} slug              Slug canónico del personaje.
 * @property {string} name              Nombre para mostrar.
 * @property {string} anime             Anime de origen.
 * @property {number} yourRank          Posición SEGÚN TUS VOTOS (1-based).
 *                                      Empates: comparten número (ranking 1224,
 *                                      el siguiente puesto se omite).
 * @property {number|null} globalRank   Posición global, o null si no hay dato.
 * @property {string} [colorDominante]  Pass-through a PersonajeImg.
 *
 * @typedef {Object} DossierSnapshot
 * @property {Record<string, number>} ranks  slug → yourRank de la sesión anterior.
 * @property {number} savedAt                Epoch ms del guardado.
 *
 * El storage es el adapter de ./dossierStorage (singleton de módulo,
 * referencia estable): localStorage solo se toca al montar
 * (loadSnapshot/loadGlobalPref) y al desmontar (saveSnapshot).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppLink } from '../../components/AppLink'
import { useSound } from '../../contexts/SoundContext'
import PersonajeImg from '../../components/PersonajeImg'
import './personal-dossier.css'

/* ——— timing de la coreografía (ms) — ver notas de handoff ——— */
const T_STAMP_SOUND = 440 // aterrizaje del sello (200 + 300 - colchón)
const T_RIBBON_HOLD = 2000 // la cinta se desvanece a los 2s de pintarse
const T_PULSE_AT = 900 // latido tras completar la entrada
const T_PULSE_AT_SKIP = 120 // latido si skipEntrance

/** Deltas vs snapshot. null si no hay snapshot (primera visita: sin cintas). */
function computeDeltas(entries, snapshot) {
  if (!snapshot || !snapshot.ranks) return null
  const map = {}
  for (const e of entries) {
    const prev = snapshot.ranks[e.slug]
    if (prev == null) map[e.slug] = { kind: 'new', n: 0 }
    else if (prev > e.yourRank) map[e.slug] = { kind: 'up', n: prev - e.yourRank }
    else if (prev < e.yourRank) map[e.slug] = { kind: 'down', n: e.yourRank - prev }
    else map[e.slug] = { kind: 'same', n: 0 }
  }
  return map
}

/** Marca empates (puesto compartido) — puro. */
function annotateTies(entries) {
  return entries.map((e, i) => ({
    ...e,
    tied:
      (i > 0 && entries[i - 1].yourRank === e.yourRank) ||
      (i < entries.length - 1 && entries[i + 1].yourRank === e.yourRank),
  }))
}

/** «hace 3 días» — se llama solo desde callbacks (recibe `now`). */
function formatSince(savedAt, now) {
  const mins = Math.max(1, Math.round((now - savedAt) / 60000))
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

/** Sello hanko con la inicial del usuario (decorativo: el nombre va en el h1). */
function HankoSeal({ initial }) {
  return (
    <span className="pd-seal" aria-hidden="true">
      <span className="pd-seal-bleed"></span>
      <span className="pd-seal-face">{initial}</span>
    </span>
  )
}

/** Celda de delta con dato textual para AT. */
function DeltaCell({ delta }) {
  if (delta.kind === 'up') {
    return (
      <span className="pd-delta pd-delta--up">
        <span aria-hidden="true">▲{delta.n}</span>
        <span className="pd-sr">{`subió ${delta.n} ${delta.n === 1 ? 'puesto' : 'puestos'} desde tu última visita`}</span>
      </span>
    )
  }
  if (delta.kind === 'down') {
    return (
      <span className="pd-delta pd-delta--down">
        <span aria-hidden="true">▼{delta.n}</span>
        <span className="pd-sr">{`bajó ${delta.n} ${delta.n === 1 ? 'puesto' : 'puestos'} desde tu última visita`}</span>
      </span>
    )
  }
  if (delta.kind === 'new') {
    return (
      <span className="pd-delta">
        <span className="pd-delta--new" aria-hidden="true">nuevo</span>
        <span className="pd-sr">nuevo en tu archivo</span>
      </span>
    )
  }
  return (
    <span className="pd-delta pd-delta--same">
      <span aria-hidden="true">·</span>
      <span className="pd-sr">sin cambios desde tu última visita</span>
    </span>
  )
}

/** Placa de personaje. */
function DossierPlate({ row, index, delta, ribbonState, showGlobal, pulsing }) {
  const moved = delta != null && (delta.kind === 'up' || delta.kind === 'down')
  return (
    <li
      className={'pd-plate' + (pulsing ? ' pd-plate--pulse' : '')}
      data-slug={row.slug}
      data-moved={moved ? 'true' : undefined}
      style={{ '--pd-i': index }}
      aria-label={`Puesto ${row.yourRank}${row.tied ? ' (empatado)' : ''}: ${row.name}, ${row.anime}`}
    >
      {moved ? (
        <span
          className={`pd-ribbon pd-ribbon--${delta.kind}${ribbonState !== 'idle' ? ` pd-ribbon--${ribbonState}` : ''}`}
          aria-hidden="true"
        ></span>
      ) : null}
      {pulsing ? <span className="pd-aura" aria-hidden="true"></span> : null}

      <span className="pd-rank" data-medal={row.yourRank <= 3 ? String(row.yourRank) : undefined}>
        <span className="pd-sr">tu puesto</span>
        <span className="pd-rank-num">{row.yourRank}</span>
        {row.tied ? (
          <span className="pd-rank-tie">
            <span aria-hidden="true">=</span>
            <span className="pd-sr">, empatado: comparten puesto</span>
          </span>
        ) : null}
      </span>

      {/* miniatura → ficha (decorativa: la navegación accesible la lleva el
          nombre; este enlace es comodidad de puntero, fuera del orden de tab) */}
      <AppLink
        to={`/personajes/${row.slug}`}
        className="pd-thumblink"
        tabIndex={-1}
        aria-hidden="true"
      >
        <PersonajeImg
          slug={row.slug}
          alt=""
          colorDominante={row.colorDominante}
          loading="lazy"
          sizes="34px"
          fit="cover"
          className="pd-thumb"
        />
      </AppLink>

      <span className="pd-id">
        {/* el nombre recupera la navegación a la ficha que tenía la fila vieja */}
        <AppLink to={`/personajes/${row.slug}`} className="pd-name">
          {row.name}
        </AppLink>
        <span className="pd-anime">{row.anime}</span>
      </span>

      {delta != null ? <DeltaCell delta={delta} /> : null}

      {showGlobal ? (
        <span className="pd-global">
          <span className="pd-sr">{row.globalRank != null ? `posición global: ${row.globalRank}º` : 'posición global: sin dato'}</span>
          <span className="pd-global-full" aria-hidden="true">{row.globalRank != null ? `global: ${row.globalRank}º` : 'global: —'}</span>
          <span className="pd-global-min" aria-hidden="true">
            <span className="pd-global-kanji" lang="ja">界</span>
            {row.globalRank != null ? row.globalRank : '—'}
          </span>
        </span>
      ) : null}
    </li>
  )
}

/**
 * @param {Object} props
 * @param {string} props.username                 Usuario de sesión (o 'invitado').
 * @param {DossierEntry[]} props.entries          Orden ascendente por yourRank. [] ⇒ vacío.
 * @param {Object} props.storage                  Adapter estable (dossierStorage).
 * @param {string|null} [props.recentVoteSlug]    Slug movido por el voto recién emitido
 *                                                (vuelta de /votar): su placa late UNA vez.
 * @param {string} [props.voteHref='/votar']      Destino del CTA del estado vacío.
 * @param {boolean} [props.skipEntrance=false]    true ⇒ sin sello/stagger (re-entrada por
 *                                                back-nav o view transition propia).
 */
export default function PersonalDossier({
  username,
  entries = [],
  storage,
  recentVoteSlug = null,
  voteHref = '/votar',
  skipEntrance = false,
}) {
  const { play } = useSound()

  // Snapshot y pref se leen SÍNCRONOS en el initializer (leer localStorage en
  // un initializer es el patrón del repo): la rejilla de la placa queda
  // correcta desde el primer frame — la columna de cintas y la de global ya
  // están (o no) sin esperar a un rAF, así que CERO CLS al montar. null del
  // snapshot = primera visita; objeto = sesión previa real.
  // (Caveat dev-only: bajo StrictMode el cleanup de guardado del primer mount
  //  descartado pisa el snapshot que el remount lee, así que en DESARROLLO las
  //  cintas pueden verse "sin cambios"; en producción no hay StrictMode y el
  //  contrato de datos honestos se mantiene.)
  const [snapshot] = useState(() => storage.loadSnapshot())
  const [sinceLabel, setSinceLabel] = useState(null)
  const [showGlobal, setShowGlobal] = useState(() => {
    const pref = storage.loadGlobalPref()
    return pref == null ? true : pref
  })
  const [ribbons, setRibbons] = useState({}) // slug → 'on' | 'off'
  const [pulseOn, setPulseOn] = useState(false)

  const listRef = useRef(null)
  const entriesRef = useRef(null)

  // espejo de entries para el guardado en unmount (escritura solo en effect)
  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  // "última visita hace X": Date.now() no puede ir en render → lo calculamos
  // en un rAF (setState dentro de callback = legal con el Compiler).
  useEffect(() => {
    if (!snapshot || !snapshot.savedAt) return undefined
    const id = requestAnimationFrame(() =>
      setSinceLabel(formatSince(snapshot.savedAt, Date.now())),
    )
    return () => cancelAnimationFrame(id)
  }, [snapshot])

  // unmount: guardar el snapshot de ESTA sesión (única escritura).
  useEffect(() => {
    return () => {
      const current = entriesRef.current
      if (current && current.length > 0) {
        const ranks = {}
        for (const e of current) ranks[e.slug] = e.yourRank
        storage.saveSnapshot({ ranks, savedAt: Date.now() })
      }
    }
  }, [storage])

  // sello: el golpe suena con el aterrizaje del hanko
  useEffect(() => {
    if (skipEntrance) return undefined
    const t = setTimeout(() => {
      play('playVerdictStamp')
    }, T_STAMP_SOUND)
    return () => clearTimeout(t)
  }, [skipEntrance, play])

  // latido del voto reciente: UNA vez, tras la entrada
  useEffect(() => {
    if (!recentVoteSlug) return undefined
    const t = setTimeout(() => {
      setPulseOn(true)
    }, skipEntrance ? T_PULSE_AT_SKIP : T_PULSE_AT)
    return () => clearTimeout(t)
  }, [recentVoteSlug, skipEntrance])

  // cintas: se pintan al entrar cada placa movida al viewport, UNA vez,
  // y se desvanecen a los 2s (saludo, no estado)
  const ribbonsActive = snapshot != null
  useEffect(() => {
    if (!ribbonsActive) return undefined
    const root = listRef.current
    if (!root) return undefined
    if (typeof IntersectionObserver === 'undefined') return undefined
    const timers = new Set()
    const io = new IntersectionObserver(
      (obs) => {
        for (const ob of obs) {
          if (!ob.isIntersecting) continue
          const slug = ob.target.getAttribute('data-slug')
          io.unobserve(ob.target)
          setRibbons((prev) => (prev[slug] ? prev : { ...prev, [slug]: 'on' }))
          const t = setTimeout(() => {
            timers.delete(t)
            setRibbons((prev) => ({ ...prev, [slug]: 'off' }))
          }, T_RIBBON_HOLD)
          timers.add(t)
        }
      },
      { threshold: 0.6 },
    )
    for (const el of root.querySelectorAll('[data-moved="true"]')) io.observe(el)
    return () => {
      io.disconnect()
      for (const t of timers) clearTimeout(t)
    }
  }, [ribbonsActive])

  function handleToggleGlobal() {
    const next = !showGlobal
    setShowGlobal(next)
    storage.saveGlobalPref(next)
    play('playClick')
  }

  /* ——— derivados memoizados (el repo memoiza a mano; no depende del
     Compiler) — el componente re-renderiza por su estado interno (cintas,
     latido, toggle) sin que cambien entries/snapshot ——— */
  const empty = entries.length === 0
  const firstVisit = snapshot === null
  const deltas = useMemo(() => computeDeltas(entries, snapshot), [entries, snapshot])
  const rows = useMemo(() => annotateTies(entries), [entries])
  const hasTies = useMemo(() => rows.some((r) => r.tied), [rows])

  let subtitle
  if (empty) subtitle = 'aún sin huellas'
  else if (firstVisit) subtitle = `${entries.length} personajes según tus votos`
  else subtitle = `${entries.length} personajes según tus votos${sinceLabel ? ` · última visita ${sinceLabel}` : ''}`

  return (
    <section
      className="pd-root"
      data-anim={skipEntrance ? undefined : 'true'}
      data-global={showGlobal ? 'true' : 'false'}
      data-deltas={deltas != null ? 'true' : 'false'}
      aria-label={`El archivo de ${username}: tu ranking personal`}
    >
      <header className="pd-head">
        <span className="pd-watermark" aria-hidden="true" lang="ja">番付</span>
        <HankoSeal initial={username.slice(0, 1).toUpperCase()} />
        <div>
          <h1 className="pd-title">
            El archivo de <span className="pd-username">{username}</span>
          </h1>
          <p className="pd-subtitle">{subtitle}</p>
        </div>
        {!empty ? (
          <button type="button" className="pd-toggle" aria-pressed={showGlobal} onClick={handleToggleGlobal}>
            <span className="pd-toggle-label-full">global</span>
            <span className="pd-toggle-label-min" aria-hidden="true" lang="ja">界</span>
            <span className="pd-toggle-track" aria-hidden="true">
              <span className="pd-toggle-knob"></span>
            </span>
            <span className="pd-sr">{showGlobal ? 'ocultar' : 'mostrar'} la posición global por personaje</span>
          </button>
        ) : null}
      </header>

      {firstVisit && !empty ? (
        <p className="pd-welcome">
          <span className="pd-welcome-kanji" aria-hidden="true" lang="ja">印</span>
          <span>
            Tu archivo queda abierto. A partir de ahora, cada visita registra quién sube y quién baja
            según tus votos.
          </span>
        </p>
      ) : null}

      {empty ? (
        <div className="pd-empty">
          <span className="pd-empty-kanji" aria-hidden="true" lang="ja">空</span>
          <p className="pd-empty-title">Tu archivo está vacío</p>
          <p className="pd-empty-copy">
            Cada duelo que votes deja huella aquí: tu propio banzuke, ordenado solo con tus decisiones.
          </p>
          <AppLink className="pd-cta" to={voteHref}>Votar mi primer duelo</AppLink>
        </div>
      ) : (
        <>
          <ol className="pd-list" ref={listRef} aria-label="Tu ranking personal">
            {rows.map((row, i) => (
              <DossierPlate
                key={row.slug}
                row={row}
                index={i}
                delta={deltas != null ? deltas[row.slug] : null}
                ribbonState={ribbons[row.slug] || 'idle'}
                showGlobal={showGlobal}
                pulsing={pulseOn && recentVoteSlug === row.slug}
              />
            ))}
          </ol>
          {hasTies ? (
            <p className="pd-tie-rule">
              <span className="pd-tie-rule-mark" aria-hidden="true">=</span> empate: comparten puesto y el
              siguiente número se omite.
            </p>
          ) : null}
          <p className="pd-foot">tu banzuke se ordena solo con tus votos · el global, con los de toda la arena</p>
        </>
      )}
    </section>
  )
}
