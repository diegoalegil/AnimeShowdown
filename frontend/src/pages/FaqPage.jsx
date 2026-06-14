import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, faqPageSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { LEGAL_CONTACT_EMAIL, LEGAL_CONTACT_MAILTO } from '../data/legal'
import './master-faq.css'

/**
 * Lista de preguntas frecuentes.
 *
 * <p>Mantenida en este array porque son ~10 preguntas estables y traerlas
 * del backend / CMS sería sobre-ingeniería. Cuando crezca a 30+ o queramos
 * editarlas sin redeploy, mover a una tabla {@code faq_items} con admin UI.
 *
 * <p>El texto de las respuestas se renderiza tal cual + se serializa
 * idéntico en el JSON-LD FAQPage. Cambia copy aquí y Google ve lo mismo
 * que el usuario — no hay riesgo de desync.
 */
const FAQ = [
  {
    categoria: 'Para empezar',
    pregunta: '¿Qué es AnimeShowdown?',
    respuesta:
      'Una plataforma para enfrentar a personajes de anime cara a cara. Tú votas en cada duelo y la comunidad va decidiendo quién manda en el ranking ELO. Gratis y sin anuncios.',
  },
  {
    categoria: 'Ranking',
    pregunta: '¿Cómo funciona el ranking competitivo?',
    respuesta:
      'AnimeShowdown separa ELO base estimado y ranking comunitario. El ELO base ordena el catálogo como punto de partida; el ranking competitivo se alimenta de votos reales, periodos y actividad de la comunidad.',
  },
  {
    categoria: 'Torneos',
    pregunta: '¿Qué son los torneos?',
    respuesta:
      'Brackets de 8 o 16 personajes a eliminación directa. Cada ronda dura mientras la comunidad vota; cuando cierra, el ganador pasa a la siguiente. Hay torneos curados por nosotros y torneos creados por usuarios verificados — todos visibles en /torneos.',
  },
  {
    categoria: 'Torneos',
    pregunta: '¿Puedo crear mi propio torneo?',
    respuesta:
      'Sí. Cualquier cuenta con email verificado puede crearlo desde /torneos/crear: eliges 8 o 16 personajes, le pones nombre y descripción, y lo revisamos antes de hacerlo público (suele ser en menos de 24 horas).',
  },
  {
    categoria: 'Torneos',
    pregunta: '¿Qué son las predicciones?',
    respuesta:
      'Mientras un torneo está activo puedes predecir quién avanzará en cada match. Cuando el duelo se resuelve, sumas un acierto a tu ratio. Encadenar 3, 10 o 20 aciertos seguidos desbloquea logros.',
  },
  {
    categoria: 'Cuenta',
    pregunta: '¿Cómo veo el perfil de otros usuarios?',
    respuesta:
      'Cada usuario tiene su perfil público en /u/su-nombre con sus stats, su top de personajes, sus logros y a quién sigue. Desde ahí puedes empezar a seguirle y recibir aviso cuando él te siga.',
  },
  {
    categoria: 'Para empezar',
    pregunta: '¿AnimeShowdown es gratis?',
    respuesta:
      'Sí, gratis y sin anuncios. Sin trackers de terceros, sin planes de pago, sin funciones bloqueadas. Si quieres echar una mano, hay una página /apoya con donaciones opcionales.',
  },
  {
    categoria: 'Soporte',
    pregunta: '¿Quién está detrás del proyecto?',
    respuesta: `AnimeShowdown es un proyecto independiente. Si tienes una idea, un bug o quieres saludar, escribe a ${LEGAL_CONTACT_EMAIL}.`,
  },
  {
    categoria: 'Catálogo',
    pregunta: '¿Cómo añado un personaje que falta?',
    respuesta:
      'Encontrarás un botón "Sugiere un personaje" en /personajes. Sirve para proponer un personaje suelto o un anime entero — la sugerencia se revisa y se añade al catálogo si encaja.',
  },
  {
    categoria: 'Cuenta',
    pregunta: '¿Mis datos están seguros?',
    respuesta:
      'Sí. La contraseña se guarda cifrada, puedes activar verificación en dos pasos, hay límite de intentos de login y el email tiene que estar verificado para acciones sensibles. No usamos trackers de publicidad ni vendemos tus datos a nadie.',
  },
]

// Numerales canónicos 一…十 (ya en el subset de la fuente kanji — sin font dance).
const KANJI_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Deriva las categorías del canvas («pestañas de cuaderno») a partir del
 * array {@code FAQ} sin tocarlo. El JSON-LD sigue recibiendo {@code FAQ} tal
 * cual (mismas preguntas/respuestas, mismo orden) — esto es solo presentación.
 * Cada entrada conserva su texto byte a byte ({@code q}=pregunta, {@code a}=respuesta).
 * El {@code id} es un slug estable y único en toda la FAQ (deep-link `#faq-<id>`).
 */
function buildCategories(items) {
  const byCat = new Map()
  items.forEach((item, index) => {
    if (!byCat.has(item.categoria)) byCat.set(item.categoria, [])
    byCat.get(item.categoria).push({
      id: `${slugify(item.categoria)}-${slugify(item.pregunta) || index}`,
      q: item.pregunta,
      a: item.respuesta,
    })
  })
  return [...byCat.entries()].map(([label, entries], i) => ({
    id: slugify(label),
    label,
    kanji: KANJI_NUMERALS[i] ?? String(i + 1),
    entries,
  }))
}

const CATEGORIES = buildCategories(FAQ)

const OVERLAP_OPEN_DELAY_MS = 120 // cierre 200ms − solape 80ms
const MIN_QUERY_LEN = 2
const SCROLL_OFFSET_PX = 88
const HASH_PREFIX = 'faq-'

/* ---------------- búsqueda: normalización con mapa de índices ---------------- */

/** Pliega un string para comparar: sin acentos, minúsculas. */
function foldText(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Texto plegado + mapa índice-plegado → índice-original (para resaltar sin mutar). */
function buildIndex(text) {
  let norm = ''
  const map = []
  for (let i = 0; i < text.length; i += 1) {
    const folded = foldText(text[i])
    for (let j = 0; j < folded.length; j += 1) {
      norm += folded[j]
      map.push(i)
    }
  }
  return { norm, map }
}

function hasMatch(text, foldedQuery) {
  return buildIndex(text).norm.indexOf(foldedQuery) !== -1
}

/** Rangos [inicio, fin) sobre el texto ORIGINAL. */
function findRanges(text, foldedQuery) {
  const { norm, map } = buildIndex(text)
  const ranges = []
  let from = 0
  for (;;) {
    const at = norm.indexOf(foldedQuery, from)
    if (at === -1) break
    ranges.push([map[at], map[at + foldedQuery.length - 1] + 1])
    from = at + foldedQuery.length
  }
  return ranges
}

/* ---------------- subcomponentes (nivel de módulo) ---------------- */

/**
 * Resalta coincidencias envolviéndolas en <mark> durante el render;
 * el string original se conserva intacto (el texto que ve Google == el del JSON-LD).
 */
function Highlight({ text, foldedQuery }) {
  if (!foldedQuery) return text
  const ranges = findRanges(text, foldedQuery)
  if (ranges.length === 0) return text
  const parts = []
  let cursor = 0
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <mark className="mf-mark" key={i}>
        {text.slice(start, end)}
      </mark>,
    )
    cursor = end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

/**
 * Pergamino plegado: botón-pregunta (aria-expanded/aria-controls) + respuesta
 * en region (aria-labelledby). El estado visual viene de [data-open]; la
 * respuesta SIEMPRE está en el DOM (texto crawlable) aunque esté plegada.
 */
function FaqItem({ entry, isOpen, foldedQuery, onToggle }) {
  const btnId = `${HASH_PREFIX}${entry.id}-q`
  const panelId = `${HASH_PREFIX}${entry.id}-a`
  return (
    <li className="mf-item" id={`${HASH_PREFIX}${entry.id}`} data-open={isOpen ? 'true' : undefined}>
      <h3 className="mf-q">
        <button
          type="button"
          id={btnId}
          className="mf-q-btn"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <Highlight text={entry.q} foldedQuery={foldedQuery} />
        </button>
      </h3>
      <span className="mf-corner" aria-hidden="true" />
      <span className="mf-chevron" aria-hidden="true" />
      <div className="mf-panel" id={panelId} role="region" aria-labelledby={btnId}>
        <div className="mf-panel-inner">
          <div className="mf-a">
            <span className="mf-cut" aria-hidden="true" />
            {entry.a.split('\n\n').map((para, i) => (
              <p key={i}>
                <Highlight text={para} foldedQuery={foldedQuery} />
              </p>
            ))}
          </div>
        </div>
      </div>
    </li>
  )
}

/* ---------------- página /faq ---------------- */

function FaqPage() {
  useSeo({
    title: 'Preguntas frecuentes',
    description:
      'Cómo funciona el ranking ELO de AnimeShowdown, cómo crear torneos, cómo se hacen las predicciones y todo lo que necesitas saber.',
  })

  const [activeCat, setActiveCat] = useState(() => (CATEGORIES[0] ? CATEGORIES[0].id : null))
  const [openByCat, setOpenByCat] = useState({})
  const [query, setQuery] = useState('')
  const [searchOverrides, setSearchOverrides] = useState({})
  const overlapTimerRef = useRef(null)

  const trimmed = query.trim()
  const foldedQuery = foldText(trimmed)
  const searching = foldedQuery.length >= MIN_QUERY_LEN

  /* resultados de búsqueda: derivado puro del render */
  const results = useMemo(() => {
    if (!searching) return null
    return CATEGORIES.map((cat) => ({
      cat,
      hits: cat.entries
        .map((entry) => {
          const inQ = hasMatch(entry.q, foldedQuery)
          const inA = hasMatch(entry.a, foldedQuery)
          return inQ || inA ? { entry, inA } : null
        })
        .filter(Boolean),
    })).filter((group) => group.hits.length > 0)
  }, [searching, foldedQuery])
  const totalHits = results ? results.reduce((n, g) => n + g.hits.length, 0) : 0

  const writeHash = (entryId) => {
    if (typeof window === 'undefined') return
    if (entryId) {
      window.history.replaceState(null, '', `#${HASH_PREFIX}${entryId}`)
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }

  const clearOverlapTimer = () => {
    if (overlapTimerRef.current !== null) {
      window.clearTimeout(overlapTimerRef.current)
      overlapTimerRef.current = null
    }
  }

  const toggleEntry = (catId, entry, currentlyOpen) => {
    if (searching) {
      /* en modo búsqueda el override manda sobre el auto-open */
      setSearchOverrides((m) => ({ ...m, [entry.id]: !currentlyOpen }))
      return
    }
    clearOverlapTimer()
    const open = openByCat[catId] || null
    if (open === entry.id) {
      setOpenByCat((m) => ({ ...m, [catId]: null }))
      writeHash(null)
      return
    }
    if (open === null) {
      setOpenByCat((m) => ({ ...m, [catId]: entry.id }))
      writeHash(entry.id)
      return
    }
    /* acordeón real: la anterior pliega primero; solape de 80ms */
    setOpenByCat((m) => ({ ...m, [catId]: null }))
    overlapTimerRef.current = window.setTimeout(() => {
      overlapTimerRef.current = null
      setOpenByCat((m) => ({ ...m, [catId]: entry.id }))
    }, OVERLAP_OPEN_DELAY_MS)
    writeHash(entry.id)
  }

  const selectCat = (catId) => {
    if (catId === activeCat) return
    clearOverlapTimer()
    setActiveCat(catId)
  }

  const onTablistKeyDown = (event) => {
    const ids = CATEGORIES.map((c) => c.id)
    const idx = ids.indexOf(activeCat)
    let next = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = ids[(idx + 1) % ids.length]
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = ids[(idx - 1 + ids.length) % ids.length]
    else if (event.key === 'Home') next = ids[0]
    else if (event.key === 'End') next = ids[ids.length - 1]
    if (next === null) return
    event.preventDefault()
    selectCat(next)
    const btn = document.getElementById(`mf-tab-${next}`)
    if (btn) btn.focus()
  }

  const onQueryChange = (event) => {
    setQuery(event.target.value)
    setSearchOverrides({})
  }

  /* limpieza del timer de solape al desmontar */
  useEffect(() => clearOverlapTimer, [])

  /* deep-link: al aterrizar (rAF) y en cada hashchange — setState solo en callbacks */
  useEffect(() => {
    const applyHash = () => {
      const raw = decodeURIComponent(window.location.hash.replace(/^#/, ''))
      if (!raw || raw.indexOf(HASH_PREFIX) !== 0) return
      const id = raw.slice(HASH_PREFIX.length)
      const cat = CATEGORIES.find((c) => c.entries.some((e) => e.id === id))
      if (!cat) return
      setQuery('')
      setSearchOverrides({})
      setActiveCat(cat.id)
      setOpenByCat((m) => (m[cat.id] === id ? m : { ...m, [cat.id]: id }))
      window.setTimeout(() => {
        const el = document.getElementById(HASH_PREFIX + id)
        if (!el) return
        const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET_PX
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
      }, 90)
    }
    const raf = window.requestAnimationFrame(applyHash)
    window.addEventListener('hashchange', applyHash)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('hashchange', applyHash)
    }
  }, [])

  return (
    <section className="master-faq" data-screen-label="/faq — Las preguntas al maestro">
      <JsonLd id="faq" schema={faqPageSchema(FAQ)} />
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'FAQ', path: '/faq' },
        ])}
      />

      <header className="mf-header">
        <span className="mf-watermark" aria-hidden="true">
          問
        </span>
        <p className="mf-eyebrow">
          <span className="mf-hanko" aria-hidden="true">
            問
          </span>
          <span className="mf-path">/faq</span>
        </p>
        <h1 className="mf-title">Preguntas frecuentes</h1>
        <p className="mf-subtitle">
          Las preguntas al maestro: todo lo que necesitas saber sobre AnimeShowdown sin tener
          que escribirnos. Si tu pregunta no está aquí, puedes mandarnos un correo a{' '}
          {LEGAL_CONTACT_EMAIL}.
        </p>
      </header>

      <div className="mf-search">
        <label className="mf-visually-hidden" htmlFor="mf-search-input">
          Buscar en preguntas y respuestas
        </label>
        <input
          id="mf-search-input"
          type="search"
          value={query}
          onChange={onQueryChange}
          placeholder="Buscar pregunta o respuesta…"
          autoComplete="off"
        />
        <p className="mf-search-count" role="status">
          {searching
            ? `${totalHits} coincidencia${totalHits === 1 ? '' : 's'} para «${trimmed}»`
            : ''}
        </p>
      </div>

      {searching ? (
        <div className="mf-results">
          {results.length === 0 ? (
            <div className="mf-empty">
              <span className="mf-empty-kanji" aria-hidden="true">
                空
              </span>
              <p>El maestro guarda silencio: nada responde a «{trimmed}».</p>
            </div>
          ) : (
            results.map((group) => (
              <section key={group.cat.id} className="mf-group" aria-label={group.cat.label}>
                <h2 className="mf-group-label">
                  <span className="mf-group-kanji" aria-hidden="true">
                    {group.cat.kanji}
                  </span>
                  {group.cat.label}
                </h2>
                <ul className="mf-list">
                  {group.hits.map(({ entry, inA }) => {
                    const isOpen =
                      searchOverrides[entry.id] !== undefined ? searchOverrides[entry.id] : inA
                    return (
                      <FaqItem
                        key={entry.id}
                        entry={entry}
                        isOpen={isOpen}
                        foldedQuery={foldedQuery}
                        onToggle={() => toggleEntry(group.cat.id, entry, isOpen)}
                      />
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      ) : (
        <div className="mf-body">
          <div
            className="mf-tabs"
            role="tablist"
            aria-label="Categorías de preguntas"
            onKeyDown={onTablistKeyDown}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                id={`mf-tab-${cat.id}`}
                className="mf-tab"
                aria-selected={cat.id === activeCat}
                aria-controls={`mf-cat-${cat.id}`}
                tabIndex={cat.id === activeCat ? 0 : -1}
                onClick={() => selectCat(cat.id)}
              >
                <span className="mf-tab-kanji" aria-hidden="true">
                  {cat.kanji}
                </span>
                <span className="mf-tab-label">{cat.label}</span>
                <span className="mf-tab-count">{cat.entries.length}</span>
              </button>
            ))}
          </div>
          {/* Todas las categorías van al DOM (las ~10 Q/A son texto crawlable);
              las inactivas se ocultan con hidden, sin borrarse. */}
          {CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              role="tabpanel"
              id={`mf-cat-${cat.id}`}
              aria-labelledby={`mf-tab-${cat.id}`}
              className="mf-tabpanel"
              hidden={cat.id !== activeCat}
            >
              <h2 className="mf-visually-hidden">{cat.label}</h2>
              <ul className="mf-list">
                {cat.entries.map((entry) => {
                  const isOpen = (openByCat[cat.id] || null) === entry.id
                  return (
                    <FaqItem
                      key={entry.id}
                      entry={entry}
                      isOpen={isOpen}
                      foldedQuery=""
                      onToggle={() => toggleEntry(cat.id, entry, isOpen)}
                    />
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mf-footer">
        <h2 className="mf-footer-title">¿No has encontrado tu respuesta?</h2>
        <p className="mf-footer-text">
          Escríbenos a {LEGAL_CONTACT_EMAIL} — leemos todo. Si quieres ojear el código o
          reportar un bug técnico, también tenemos repo público en GitHub.
        </p>
        <div className="mf-footer-actions">
          <a href={LEGAL_CONTACT_MAILTO} className="mf-btn mf-btn-primary">
            Escribir a soporte
          </a>
          <a
            href="https://github.com/diegoalegil/AnimeShowdown/issues"
            target="_blank"
            rel="noreferrer"
            className="mf-btn mf-btn-ghost"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Reportar bug en GitHub
          </a>
        </div>
      </div>

      <div className="mf-links">
        <Link to="/personajes" className="mf-link">
          Catálogo de personajes
        </Link>
        <span className="mf-link-sep" aria-hidden="true">
          ·
        </span>
        <Link to="/torneos" className="mf-link">
          Torneos activos
        </Link>
        <span className="mf-link-sep" aria-hidden="true">
          ·
        </span>
        <Link to="/ranking" className="mf-link">
          Ranking ELO
        </Link>
      </div>
    </section>
  )
}

export default FaqPage
