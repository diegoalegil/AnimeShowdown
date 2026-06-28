/**
 * TierListsPage — restyle «mesa del editor» (Kessen).
 *
 * <p>Destino: frontend/src/pages/TierListsPage.jsx (sustituye al actual).
 *
 * <p>Qué cambia respecto a los paneles planos tipo spreadsheet:
 * <ul>
 *   <li><b>Bandas lacadas</b>: cada tier es una lámina de lacado oscuro con
 *   canto dorado y su kanji de rango grabado a la izquierda — 神 強 良 可 微
 *   控. La jerarquía la marca la caligrafía (tamaño + tinta), no el arcoíris.
 *   <li><b>Drag con peso</b>: motor pointer-events propio (cero libs nuevas),
 *   transform-only. El ghost persigue al puntero con un muelle (rAF SOLO
 *   durante el gesto), micro-inercia al soltar y encaje con squash sutil
 *   (framer-motion) en la banda. Con prefers-reduced-motion: drag directo,
 *   sin física, sin squash.
 *   <li><b>Export como clímax</b>: flash de cámara (frame blanco de 60ms +
 *   obturador sintetizado con WebAudio) y el PNG sale con marco de
 *   federación. El pintor (tierlist-export-theme.js) entra por import()
 *   dinámico — fuera del bundle inicial.
 * </ul>
 *
 * <p>Notas perf: nada de blur/backdrop-blur nuevos; el lacado es gradiente +
 * hairline estáticos. El ghost y el caret viven en portales y solo mutan
 * transform/opacity vía ref — ningún re-render de React por frame.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Camera,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Plus,
  Save,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import {
  useActualizarTierList,
  useCrearTierList,
  useEliminarTierList,
  useMisTierLists,
  useTierListPublic,
} from '../hooks/useTierLists'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import { slugifyAnime } from '../lib/animes'
import { imagenPersonaje } from '../lib/personajes-core'
import { recordDailyShare } from '../lib/dailyProgress'
import { shareOrCopy } from '../lib/share'
import AutocompletePersonaje from '../components/AutocompletePersonaje'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import JsonLd from '../components/JsonLd'
import PersonajeImg from '../components/PersonajeImg'
import BrandSelect from '../components/BrandSelect'
import '../features/tierList/tier-mesa.css'

const TIERS = ['S', 'A', 'B', 'C', 'D', 'BANCA']
/* Kanji con significado: 神 dios · 強 fuerte · 良 bueno · 可 aceptable ·
   微 ínfimo · 控 reserva (banca). */
const TIER_KANJI = { S: '神', A: '強', B: '良', C: '可', D: '微', BANCA: '控' }
/* Jerarquía por caligrafía: tamaño y tinta descienden con el rango. */
const TIER_CAL = {
  S: 'text-[2.6rem] text-gold-bright/95',
  A: 'text-[2.25rem] text-gold/70',
  B: 'text-[2rem] text-gold/55',
  C: 'text-[1.8rem] text-gold/40',
  D: 'text-[1.7rem] text-gold/30',
  BANCA: 'text-[1.35rem] text-gold/25',
}
/* Grabado: sombra oscura arriba + filo de luz abajo (capas estáticas,
   clase en tier-mesa.css — el guard de literales manda). */
const ENGRAVE = 'tier-grabado'
const TITULO_DEFAULT = 'Mi tier list anime'
const MAX_ITEMS = 120
const EASE_LIFT = [0.16, 1, 0.3, 1]

function TierListsPage() {
  const { slug } = useParams()
  if (slug) return <TierListPublicView slug={slug} />
  return <TierListEditor />
}

/* ============================================================
   Motor de drag con peso — pointer events, transform-only.
   rAF corre SOLO mientras hay un gesto activo; el ghost y el
   caret se mutan vía ref (cero re-renders por frame).
   ============================================================ */
function useTierDrag({ physicsRef, onDrop }) {
  const [drag, setDrag] = useState(null) // { personaje, w, h, x0, y0 }
  const [hot, setHot] = useState(null) // { tier, index, caret }
  const session = useRef(null)
  const ghostRef = useRef(null)
  const hotRef = useRef(null)

  const cleanup = useCallback(() => {
    const s = session.current
    if (s) {
      s.active = false
      if (s.raf) cancelAnimationFrame(s.raf)
      window.removeEventListener('pointermove', s.onMove)
      window.removeEventListener('pointerup', s.onUp)
      window.removeEventListener('pointercancel', s.onUp)
    }
    session.current = null
    hotRef.current = null
    setHot(null)
  }, [])

  useEffect(() => cleanup, [cleanup])

  const startDrag = useCallback(
    (event, personaje) => {
      if (session.current) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const rect = event.currentTarget.getBoundingClientRect()
      const s = {
        personaje,
        active: false,
        startX: event.clientX,
        startY: event.clientY,
        offX: event.clientX - rect.left,
        offY: event.clientY - rect.top,
        w: rect.width,
        h: rect.height,
        px: event.clientX,
        py: event.clientY,
        gx: rect.left,
        gy: rect.top,
        lastTx: rect.left,
        lastTy: rect.top,
        vx: 0,
        vy: 0,
        raf: 0,
      }

      const computeHot = () => {
        for (const rowEl of document.querySelectorAll('[data-tier-row]')) {
          const r = rowEl.getBoundingClientRect()
          if (s.px < r.left || s.px > r.right || s.py < r.top || s.py > r.bottom) continue
          const tier = rowEl.dataset.tierRow
          const cards = [...rowEl.querySelectorAll('[data-card-slug]')].filter(
            (el) => el.dataset.cardSlug !== personaje.slug,
          )
          let index = 0
          for (const el of cards) {
            const cr = el.getBoundingClientRect()
            if (s.py > cr.bottom || (s.py >= cr.top - 8 && s.px > cr.left + cr.width / 2)) {
              index += 1
            }
          }
          let caret
          if (cards.length === 0) {
            caret = { x: r.left + 8, y: r.top + 9, h: s.h }
          } else if (index < cards.length) {
            const cr = cards[index].getBoundingClientRect()
            caret = { x: cr.left - 5, y: cr.top, h: cr.height }
          } else {
            const cr = cards[cards.length - 1].getBoundingClientRect()
            caret = { x: cr.right + 3, y: cr.top, h: cr.height }
          }
          return { tier, index, caret }
        }
        return null
      }

      const applyHot = () => {
        const next = computeHot()
        const prev = hotRef.current
        if (
          (next === null) !== (prev === null) ||
          (next && prev && (next.tier !== prev.tier || next.index !== prev.index))
        ) {
          hotRef.current = next
          setHot(next)
        }
      }

      /* El muelle del ghost: persigue al puntero con retardo — el "peso". */
      const loop = () => {
        if (!s.active) return
        const tx = s.px - s.offX
        const ty = s.py - s.offY
        s.gx += (tx - s.gx) * 0.3
        s.gy += (ty - s.gy) * 0.3
        s.vx = tx - s.lastTx
        s.vy = ty - s.lastTy
        s.lastTx = tx
        s.lastTy = ty
        const tilt = Math.max(-7, Math.min(7, (tx - s.gx) * 0.14))
        if (ghostRef.current) {
          ghostRef.current.style.transform = `translate3d(${s.gx}px,${s.gy}px,0) rotate(${tilt}deg) scale(1.07)`
        }
        s.raf = requestAnimationFrame(loop)
      }

      s.onMove = (ev) => {
        s.px = ev.clientX
        s.py = ev.clientY
        if (!s.active) {
          if (Math.hypot(s.px - s.startX, s.py - s.startY) < 6) return
          s.active = true
          setDrag({ personaje, w: s.w, h: s.h, x0: s.gx, y0: s.gy })
          if (physicsRef.current) s.raf = requestAnimationFrame(loop)
        }
        if (!physicsRef.current && ghostRef.current) {
          s.gx = s.px - s.offX
          s.gy = s.py - s.offY
          ghostRef.current.style.transform = `translate3d(${s.gx}px,${s.gy}px,0)`
        }
        applyHot()
      }

      s.onUp = () => {
        const wasActive = s.active
        const target = hotRef.current
        const ghost = ghostRef.current
        const withPhysics = physicsRef.current
        cleanup()
        if (wasActive && target) {
          onDrop(personaje.slug, target.tier, target.index, withPhysics)
        }
        if (wasActive && ghost && withPhysics) {
          /* micro-inercia: el ghost sigue su velocidad y se funde */
          ghost.style.transition =
            'transform 0.18s cubic-bezier(0.16,1,0.3,1), opacity 0.18s ease-out'
          ghost.style.opacity = '0'
          ghost.style.transform = `translate3d(${s.gx + s.vx * 4}px,${s.gy + s.vy * 4}px,0) rotate(0deg) scale(1)`
          setTimeout(() => setDrag(null), 190)
        } else {
          setDrag(null)
        }
      }

      session.current = s
      window.addEventListener('pointermove', s.onMove)
      window.addEventListener('pointerup', s.onUp)
      window.addEventListener('pointercancel', s.onUp)
    },
    [cleanup, onDrop, physicsRef],
  )

  return { drag, hot, ghostRef, startDrag }
}

/* ============================================================
   Editor
   ============================================================ */
function TierListEditor() {
  const { user } = useAuth()
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const mineQuery = useMisTierLists()
  const crearTierList = useCrearTierList()
  const actualizarTierList = useActualizarTierList()
  const eliminarTierList = useEliminarTierList()
  const reducedMotion = useReducedMotion()
  const [titulo, setTitulo] = useState(TITULO_DEFAULT)
  const [publico, setPublico] = useState(false)
  const [animeSlug, setAnimeSlug] = useState('')
  const [selectedAnime, setSelectedAnime] = useState('')
  const [rows, setRows] = useState(createEmptyRows)
  const [current, setCurrent] = useState(null)
  const [landingSlug, setLandingSlug] = useState(null)
  const landingTimer = useRef(0)

  const physicsRef = useRef(!reducedMotion)
  useEffect(() => {
    physicsRef.current = !reducedMotion
  }, [reducedMotion])

  useSeo({
    title: 'Tier lists anime — AnimeShowdown',
    description: 'Crea, guarda y comparte tier lists de personajes anime.',
    canonical: 'https://animeshowdown.dev/tier-lists',
  })

  const onDrop = useCallback((slug, tier, index, withPhysics) => {
    setRows((prev) => moveSlug(prev, slug, tier, index))
    if (withPhysics) {
      clearTimeout(landingTimer.current)
      setLandingSlug(slug)
      landingTimer.current = setTimeout(() => setLandingSlug(null), 420)
    }
  }, [])

  const { drag, hot, ghostRef, startDrag } = useTierDrag({ physicsRef, onDrop })

  const catalogoBySlug = useMemo(
    () => new Map(catalogoPersonajes.map((p) => [p.slug, p])),
    [catalogoPersonajes],
  )
  const ocupados = useMemo(() => new Set(flattenRows(rows).map((p) => p.slug)), [rows])
  const total = ocupados.size
  const animes = useMemo(
    () =>
      [...new Set(catalogoPersonajes.map((p) => p.anime).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [catalogoPersonajes],
  )
  const canSave = Boolean(user) && !crearTierList.isPending && !actualizarTierList.isPending
  const sharePath = current?.slug && publico ? `/tier-lists/${current.slug}` : null

  const addSlug = (slug) => {
    if (ocupados.has(slug)) {
      toast.info('Ese personaje ya está en la tier list')
      return
    }
    const personaje = catalogoBySlug.get(slug)
    if (!personaje?.id) {
      toast.info('Catálogo actualizándose. Espera unos segundos.')
      return
    }
    if (total >= MAX_ITEMS) {
      toast.info('Límite de 120 personajes alcanzado')
      return
    }
    setRows((prev) => ({ ...prev, BANCA: [...prev.BANCA, personaje] }))
  }

  const cargarAnime = () => {
    if (!selectedAnime) {
      setRows(createEmptyRows())
      setAnimeSlug('')
      setCurrent(null)
      setTitulo(TITULO_DEFAULT)
      setPublico(false)
      return
    }
    const existentes = new Set(flattenRows(rows).map((p) => p.slug))
    const disponibles = catalogoPersonajes
      .filter((p) => p.anime === selectedAnime && p.id && !existentes.has(p.slug))
      .slice(0, Math.max(0, MAX_ITEMS - total))
    if (disponibles.length === 0) {
      toast.info('No hay personajes nuevos para esa plantilla')
      return
    }
    setRows((prev) => ({ ...prev, BANCA: [...prev.BANCA, ...disponibles] }))
    setAnimeSlug(slugifyAnime(selectedAnime))
    if (titulo === TITULO_DEFAULT) {
      setTitulo(`Tier list de ${selectedAnime}`)
    }
  }

  const quitarSlug = (slug) => setRows((prev) => removeSlug(prev, slug))

  const loadExisting = (tierList) => {
    setTitulo(tierList.titulo || TITULO_DEFAULT)
    setPublico(Boolean(tierList.publico))
    setAnimeSlug(tierList.animeSlug || '')
    setRows(rowsFromDto(tierList))
    setCurrent({ id: tierList.id, slug: tierList.slug })
    toast.success('Tier list cargada')
  }

  const nuevo = () => {
    setTitulo(TITULO_DEFAULT)
    setPublico(false)
    setAnimeSlug('')
    setSelectedAnime('')
    setRows(createEmptyRows())
    setCurrent(null)
  }

  const guardar = async () => {
    if (!user) return
    const data = {
      titulo: titulo.trim() || TITULO_DEFAULT,
      animeSlug: animeSlug || null,
      publico,
      items: serializeRows(rows),
    }
    if (data.items.length !== total) {
      toast.error('Hay personajes sin id de catálogo')
      return
    }
    try {
      const saved = current?.id
        ? await actualizarTierList.mutateAsync({ id: current.id, data })
        : await crearTierList.mutateAsync(data)
      setCurrent({ id: saved.id, slug: saved.slug })
      setRows(rowsFromDto(saved))
      toast.success('Tier list guardada')
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar')
    }
  }

  const eliminar = async () => {
    if (!current?.id) return
    if (!window.confirm('Eliminar tier list')) return
    try {
      await eliminarTierList.mutateAsync(current.id)
      nuevo()
      toast.success('Tier list eliminada')
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar')
    }
  }

  if (!user) {
    return (
      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <EmptyState
            icon={Layers}
            title="Tier lists"
            description="Inicia sesión para crear y guardar tus tier lists."
            action={{ to: '/login', label: 'Entrar' }}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="px-5 py-8 sm:px-8 sm:py-12" data-screen-label="Mesa del editor">
      <JsonLd
        id="tier-lists-breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Tier lists', path: '/tier-lists' },
        ])}
      />
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Inicio
        </Link>
        <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-border-gold-subtle bg-gold-soft px-3 py-1 text-[12px] font-black text-gold">
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              Tier lists
            </span>
            <h1 className="text-3xl font-black tracking-tight text-fg-strong sm:text-4xl">
              Mesa del editor
            </h1>
            <p className="mt-2 text-sm text-fg-muted [text-wrap:pretty]">
              Arrastra cartas a su rango. La jerarquía la marca la caligrafía
              — 神 強 良 可 微 — no el arcoíris.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={nuevo}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nueva
            </Button>
            <Button type="button" onClick={guardar} disabled={!canSave}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Guardar
            </Button>
            {current?.id && (
              <Button
                type="button"
                variant="ghost"
                onClick={eliminar}
                disabled={eliminarTierList.isPending}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Eliminar
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <section className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end sm:p-5">
              <label className="min-w-0">
                <span className="mb-1 block text-[12px] font-black text-fg-muted">
                  Título
                </span>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm font-semibold text-fg-strong outline-none transition-colors focus:border-accent/55"
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-sm font-black text-fg-strong">
                <input
                  type="checkbox"
                  checked={publico}
                  onChange={(e) => setPublico(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                {publico ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                Pública
              </label>
              <span className="pb-3 font-mono text-xs text-fg-muted">
                <b className="font-bold text-gold">{total}</b>/{MAX_ITEMS}
              </span>
            </section>

            {/* La mesa: bandas lacadas sueltas sobre el lienzo — fuera el
                panel-de-paneles tipo spreadsheet. */}
            <div className="flex flex-col gap-2.5" data-screen-label="Tablero">
              {TIERS.map((tier) => (
                <TierRow
                  key={tier}
                  tier={tier}
                  items={rows[tier]}
                  isHot={hot?.tier === tier}
                  dragSlug={drag?.personaje.slug ?? null}
                  landingSlug={landingSlug}
                  onCardPointerDown={startDrag}
                  onRemove={quitarSlug}
                />
              ))}
            </div>

            <TierListExportPanel
              titulo={titulo}
              rows={rows}
              publicSlug={sharePath ? current.slug : null}
            />
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-black text-fg-muted">
                Añadir personaje
              </h2>
              <AutocompletePersonaje
                onSelect={addSlug}
                placeholder="Busca personaje"
                filtroExtra={(p) => !ocupados.has(p.slug)}
              />
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-black text-fg-muted">
                Plantilla
              </h2>
              <div className="flex gap-2">
                <BrandSelect
                  value={selectedAnime}
                  onChange={setSelectedAnime}
                  ariaLabel="Elegir plantilla de anime"
                  className="min-w-0 flex-1"
                  placeholder="Vacía"
                  options={[
                    { value: '', label: 'Vacía' },
                    ...animes.map((anime) => ({ value: anime, label: anime })),
                  ]}
                />
                <button
                  type="button"
                  onClick={cargarAnime}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-sm font-black text-fg-strong transition-colors hover:border-accent/45"
                  aria-label="Cargar plantilla"
                >
                  <FolderOpen className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </section>

            {sharePath && (
              <section className="rounded-2xl border border-border-gold-subtle bg-gold-soft p-4 sm:p-5">
                <h2 className="mb-2 text-sm font-black text-gold">
                  Pública
                </h2>
                <Link
                  to={sharePath}
                  className="break-all text-sm font-semibold text-fg-strong transition-colors hover:text-gold"
                >
                  {sharePath}
                </Link>
              </section>
            )}

            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-black text-fg-muted">
                Guardadas
              </h2>
              {mineQuery.isLoading ? (
                <p className="text-sm text-fg-muted">Cargando</p>
              ) : (mineQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-fg-muted">Sin tier lists guardadas</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {(mineQuery.data ?? []).map((tierList) => (
                    <button
                      key={tierList.id}
                      type="button"
                      onClick={() => loadExisting(tierList)}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2 text-left transition-colors hover:border-accent/45"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-fg-strong">
                          {tierList.titulo}
                        </span>
                        <span className="block text-[11px] text-fg-muted">
                          {tierList.publico ? 'Pública' : 'Privada'}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] font-black text-gold">
                        {(tierList.items ?? []).length}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      <DragGhost drag={drag} ghostRef={ghostRef} />
      {drag && hot?.caret && (
        <DropCaret caret={hot.caret} />
      )}
    </section>
  )
}

/* ============================================================
   Vista pública
   ============================================================ */
function TierListPublicView({ slug }) {
  const tierListQuery = useTierListPublic(slug)
  const tierList = tierListQuery.data
  const rows = useMemo(() => rowsFromDto(tierList), [tierList])

  useSeo({
    title: tierList?.titulo
      ? `${tierList.titulo} — Tier list anime`
      : 'Tier list anime — AnimeShowdown',
    description: tierList?.username
      ? `Tier list pública de @${tierList.username} en AnimeShowdown.`
      : 'Tier list pública en AnimeShowdown.',
    canonical: `https://animeshowdown.dev/tier-lists/${slug}`,
  })

  if (tierListQuery.isLoading) {
    return (
      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl text-sm text-fg-muted">Cargando</div>
      </section>
    )
  }

  if (tierListQuery.isError || !tierList) {
    return (
      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <EmptyState
            icon={Layers}
            title="Tier list no disponible"
            description="Puede ser privada o haber sido eliminada."
            action={{ to: '/tier-lists', label: 'Crear tier list' }}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="px-5 py-8 sm:px-8 sm:py-12" data-screen-label="Tier list pública">
      <JsonLd
        id="tier-list-public-breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Tier lists', path: '/tier-lists' },
          { label: tierList.titulo, path: `/tier-lists/${slug}` },
        ])}
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <Link
          to="/tier-lists"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Tier lists
        </Link>
        <header className="border-b border-border pb-5">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-border-gold-subtle bg-gold-soft px-3 py-1 text-[12px] font-black text-gold">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            @{tierList.username}
          </span>
          <h1 className="text-3xl font-black tracking-tight text-fg-strong sm:text-4xl">
            {tierList.titulo}
          </h1>
        </header>
        <div className="flex flex-col gap-2.5">
          {TIERS.map((tier) => (
            <TierRow key={tier} tier={tier} items={rows[tier]} readOnly />
          ))}
        </div>
        <TierListExportPanel
          titulo={tierList.titulo}
          rows={rows}
          publicSlug={tierList.slug}
        />
      </div>
    </section>
  )
}

/* ============================================================
   Banda lacada — canto dorado + kanji de rango grabado
   ============================================================ */
function TierRow({
  tier,
  items,
  readOnly = false,
  isHot = false,
  dragSlug = null,
  landingSlug = null,
  onCardPointerDown,
  onRemove,
}) {
  return (
    <div
      data-screen-label={`Banda ${tier}`}
      className={`relative grid min-h-[7.5rem] grid-cols-[4.5rem_minmax(0,1fr)] overflow-hidden rounded-xl border bg-gradient-to-b from-surface to-bg shadow-elev-1 inset-shadow-hairline transition-colors sm:grid-cols-[5.25rem_minmax(0,1fr)] ${
        isHot ? 'border-border-gold' : 'border-gold/15'
      }`}
    >
      {/* barrido especular del lacado — capa estática, cero blur */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent"
      ></span>
      {/* canto dorado */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b ${
          isHot ? 'from-gold-bright to-gold/40' : 'from-gold/85 to-gold/25'
        }`}
      ></span>

      <div className="relative flex flex-col items-center justify-center gap-0.5 border-r border-gold/15 bg-gradient-to-b from-surface-alt to-canvas px-1 py-2">
        <span className="absolute right-1.5 top-1.5 font-mono text-[10px] text-gold/55" aria-hidden="true">
          {tier === 'BANCA' ? '—' : tier}
        </span>
        <span
          aria-hidden="true"
          className={`select-none font-kanji-serif font-black leading-none ${TIER_CAL[tier]} ${ENGRAVE}`}
        >
          {TIER_KANJI[tier]}
        </span>
        <span className="font-mono text-[9.5px] tracking-wider text-fg-muted">
          {tier === 'BANCA' ? 'BANCA' : `TIER ${tier}`}
        </span>
      </div>

      <div
        className="relative flex min-h-[7.5rem] flex-wrap content-start gap-2 p-2"
        data-tier-row={readOnly ? undefined : tier}
      >
        {items.length === 0 ? (
          <span className="flex min-h-24 items-center px-2 font-mono text-xs text-fg-muted/80">
            {isHot ? 'suelta aquí' : 'vacío'}
          </span>
        ) : (
          items.map((personaje) => (
            <TierCard
              key={personaje.slug}
              personaje={personaje}
              readOnly={readOnly}
              isDragSource={dragSlug === personaje.slug}
              landing={landingSlug === personaje.slug}
              onPointerDown={(e) => onCardPointerDown?.(e, personaje)}
              onRemove={() => onRemove?.(personaje.slug)}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Carta 2:3 — arte a sangre, scrim solo bajo el nombre
   ============================================================ */
function TierCard({ personaje, readOnly, isDragSource, landing, onPointerDown, onRemove }) {
  return (
    <motion.article
      data-card-slug={personaje.slug}
      onPointerDown={readOnly ? undefined : onPointerDown}
      animate={
        landing
          ? { scaleX: [1.05, 0.97, 1], scaleY: [0.88, 1.05, 1] }
          : { scaleX: 1, scaleY: 1 }
      }
      transition={{ duration: 0.34, ease: EASE_LIFT }}
      style={{ transformOrigin: '50% 85%' }}
      // touch-none (no touch-pan-y): el motor de drag es 2D — mover una carta de
      // un tier a otro es un gesto VERTICAL. Con pan-y el navegador reclama el
      // eje Y para scroll y dispara pointercancel, rompiendo el arrastre en táctil.
      className={`group relative aspect-[2/3] w-[4.25rem] shrink-0 cursor-grab touch-none overflow-hidden rounded-lg border border-white/10 bg-surface-alt transition-colors will-change-transform hover:border-gold/50 sm:w-[4.75rem] ${
        isDragSource ? 'opacity-25 grayscale' : ''
      }`}
    >
      <PersonajeImg
        slug={personaje.slug}
        src={personaje.imagenUrl ?? personaje.imagen}
        alt={personaje.nombre}
        nombre={personaje.nombre}
        imagenColorDominante={personaje.imagenColorDominante}
        loading="lazy"
        sizes="76px"
        className="h-full w-full object-cover object-top"
        draggable={false}
      />
      {/* scrim de legibilidad SOLO donde hay texto encima */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-canvas/90 to-transparent px-1 pb-1 pt-4">
        <span className="line-clamp-2 text-[9.5px] font-extrabold leading-[1.18] text-fg-strong text-shadow-scrim-sm">
          {personaje.nombre}
        </span>
      </span>
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-bg/90 text-fg-muted opacity-0 transition-opacity hover:text-fg-strong focus:opacity-100 group-hover:opacity-100"
          aria-label={`Quitar ${personaje.nombre}`}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </motion.article>
  )
}

/* Ghost flotante del drag: portal, solo transform/opacity vía ref. */
function DragGhost({ drag, ghostRef }) {
  if (!drag) return null
  return createPortal(
    <div
      ref={ghostRef}
      className="pointer-events-none fixed left-0 top-0 z-50 overflow-hidden rounded-lg border border-border-gold bg-surface-alt shadow-elev-2 will-change-transform"
      style={{
        width: drag.w,
        height: drag.h,
        transform: `translate3d(${drag.x0}px,${drag.y0}px,0) scale(1.07)`,
      }}
    >
      <PersonajeImg
        slug={drag.personaje.slug}
        src={drag.personaje.imagenUrl ?? drag.personaje.imagen}
        alt=""
        nombre={drag.personaje.nombre}
        imagenColorDominante={drag.personaje.imagenColorDominante}
        loading="eager"
        sizes="76px"
        className="h-full w-full object-cover object-top"
      />
    </div>,
    document.body,
  )
}

/* Indicador de inserción. */
function DropCaret({ caret }) {
  return createPortal(
    <span
      aria-hidden="true"
      className="pointer-events-none fixed z-40 w-0.5 rounded-full bg-gold-bright"
      style={{ left: caret.x, top: caret.y, height: caret.h }}
    ></span>,
    document.body,
  )
}

/* ============================================================
   EXPORT — el clímax: flash de cámara + marco de federación.
   El pintor entra por import() dinámico (bundle inicial intacto).
   ============================================================ */
function cargarImg(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function TierListExportPanel({ titulo, rows, publicSlug }) {
  const { user } = useAuth()
  const { play } = useSound()
  const canvasRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const [generando, setGenerando] = useState(false)
  const [flashKey, setFlashKey] = useState(null)
  const [preview, setPreview] = useState(null)
  const [compartiendo, setCompartiendo] = useState(false)
  const signature = useMemo(
    () =>
      JSON.stringify({
        titulo,
        rows: TIERS.map((tier) => [tier, (rows[tier] ?? []).map((p) => p.slug)]),
      }),
    [rows, titulo],
  )
  const previewActual = preview?.signature === signature ? preview : null
  const total = TIERS.reduce((sum, tier) => sum + (rows[tier]?.length ?? 0), 0)

  const exportar = async () => {
    if (total === 0 || generando || !canvasRef.current) return
    setGenerando(true)
    try {
      /* pintor pesado: lazy, fuera del bundle inicial */
      const { renderTierListExport } = await import(
        '../features/tierList/tierlist-export-theme'
      )
      const canvas = canvasRef.current
      canvas.width = 1200
      canvas.height = 630
      await renderTierListExport(canvas.getContext('2d'), {
        titulo,
        usuario: user?.username ? `@${user.username}` : '',
        rows,
        loadImage: (p) =>
          cargarImg(p?.imagenUrl ?? p?.imagen ?? imagenPersonaje(p?.slug)),
      })
      const blob = await canvasToPngBlob(canvas)
      const url = canvas.toDataURL('image/png')
      if (!reducedMotion) {
        play('playShutter')
        setFlashKey(Date.now())
        setTimeout(() => setFlashKey(null), 450)
        setTimeout(() => setPreview({ url, blob, signature }), 150)
      } else {
        /* reduced-motion: ni flash ni obturador */
        setPreview({ url, blob, signature })
      }
    } catch (error) {
      toast.error(error?.message || 'No se pudo generar el PNG')
    } finally {
      setGenerando(false)
    }
  }

  const descargar = () => {
    if (!previewActual) return
    const a = document.createElement('a')
    a.href = previewActual.url
    a.download = 'animeshowdown-tier-list.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const compartir = async () => {
    if (!previewActual) return
    setCompartiendo(true)
    const shareUrl = publicSlug ? `/tier-lists/${publicSlug}` : '/tier-lists'
    const absoluteUrl =
      typeof window !== 'undefined'
        ? new URL(shareUrl, window.location.origin).toString()
        : shareUrl
    try {
      const file =
        previewActual.blob && typeof File !== 'undefined'
          ? new File([previewActual.blob], 'animeshowdown-tier-list.png', {
              type: 'image/png',
            })
          : null
      if (
        file &&
        typeof navigator !== 'undefined' &&
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        try {
          await navigator.share({
            title: titulo || 'Tier list anime',
            text: 'Mi tier list anime en AnimeShowdown',
            url: absoluteUrl,
            files: [file],
          })
          recordDailyShare()
          toast.success('Tier list compartida')
          return
        } catch (error) {
          if (error?.name === 'AbortError') return
        }
      }
      const result = await shareOrCopy({
        title: titulo || 'Tier list anime',
        text: 'Mi tier list anime en AnimeShowdown',
        url: shareUrl,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Tier list compartida' : 'Enlace copiado')
    } catch {
      toast.error('No se pudo compartir')
    } finally {
      setCompartiendo(false)
    }
  }

  return (
    <section
      className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
      data-screen-label="Export"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-fg-muted">Exportar</h2>
          <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">
            El PNG sale con marco de federación — hairline dorada, wordmark y
            sello <span className="font-kanji-serif text-gold">戦</span> — no
            una captura cruda.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={exportar} disabled={total === 0 || generando}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            {generando ? 'Revelando…' : 'Exportar PNG'}
          </Button>
          {previewActual && (
            <>
              <Button type="button" variant="secondary" onClick={descargar}>
                <Download className="h-4 w-4" aria-hidden="true" />
                PNG
              </Button>
              <button
                type="button"
                onClick={compartir}
                disabled={compartiendo}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-gold-subtle bg-gold-soft px-4 text-sm font-black text-gold transition-colors hover:border-border-gold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Compartir
              </button>
            </>
          )}
        </div>
      </div>
      {previewActual && (
        <motion.img
          initial={reducedMotion ? false : { opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.42, ease: EASE_LIFT }}
          src={previewActual.url}
          alt="Vista previa de la tier list con marco de federación"
          width={1200}
          height={630}
          className="mt-4 w-full rounded-lg border border-border-gold-subtle shadow-elev-2"
        />
      )}
      <canvas ref={canvasRef} width={1200} height={630} className="hidden" />
      {/* flash de cámara: frame blanco de 60ms + fundido; se desmonta solo */}
      {flashKey &&
        createPortal(
          <motion.div
            key={flashKey}
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 0] }}
            transition={{ duration: 0.4, times: [0, 0.15, 1], ease: 'easeOut' }}
            className="pointer-events-none fixed inset-0 z-50 bg-white"
            aria-hidden="true"
          ></motion.div>,
          document.body,
        )}
    </section>
  )
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('El navegador no pudo exportar la imagen.'))
    }, 'image/png')
  })
}

/* ============================================================
   Helpers de filas (sin cambios funcionales)
   ============================================================ */
function createEmptyRows() {
  return Object.fromEntries(TIERS.map((tier) => [tier, []]))
}

function rowsFromDto(tierList) {
  const rows = createEmptyRows()
  for (const item of tierList?.items ?? []) {
    const tier = TIERS.includes(item.tier) ? item.tier : 'BANCA'
    if (item.personaje?.slug) {
      rows[tier].push(item.personaje)
    }
  }
  for (const tier of TIERS) {
    rows[tier].sort((a, b) => {
      const itemA = (tierList?.items ?? []).find((item) => item.personaje?.slug === a.slug)
      const itemB = (tierList?.items ?? []).find((item) => item.personaje?.slug === b.slug)
      return (itemA?.posicion ?? 0) - (itemB?.posicion ?? 0)
    })
  }
  return rows
}

function flattenRows(rows) {
  return TIERS.flatMap((tier) => rows[tier] ?? [])
}

function removeSlug(rows, slug) {
  return Object.fromEntries(
    TIERS.map((tier) => [tier, (rows[tier] ?? []).filter((p) => p.slug !== slug)]),
  )
}

function moveSlug(rows, slug, targetTier, targetIndex) {
  const moving = flattenRows(rows).find((p) => p.slug === slug)
  if (!moving) return rows
  const next = removeSlug(rows, slug)
  const target = [...(next[targetTier] ?? [])]
  const safeIndex = Math.max(0, Math.min(target.length, targetIndex))
  target.splice(safeIndex, 0, moving)
  return {
    ...next,
    [targetTier]: target,
  }
}

function serializeRows(rows) {
  return TIERS.flatMap((tier) =>
    (rows[tier] ?? [])
      .map((personaje, posicion) => {
        const personajeId = Number(personaje.id)
        if (!Number.isFinite(personajeId)) return null
        return { personajeId, tier, posicion }
      })
      .filter(Boolean),
  )
}

export default TierListsPage
