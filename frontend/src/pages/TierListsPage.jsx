import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
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
import AutocompletePersonaje from '../components/AutocompletePersonaje'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import JsonLd from '../components/JsonLd'
import PersonajeImg from '../components/PersonajeImg'
import TierListCanvasPreview from '../features/tierList/TierListCanvasPreview'

const TIERS = ['S', 'A', 'B', 'C', 'D', 'BANCA']
const TIER_LABEL = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  BANCA: 'Banca',
}
const TITULO_DEFAULT = 'Mi tier list anime'
const MAX_ITEMS = 120

function TierListsPage() {
  const { slug } = useParams()
  if (slug) return <TierListPublicView slug={slug} />
  return <TierListEditor />
}

function TierListEditor() {
  const { user } = useAuth()
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const mineQuery = useMisTierLists()
  const crearTierList = useCrearTierList()
  const actualizarTierList = useActualizarTierList()
  const eliminarTierList = useEliminarTierList()
  const [titulo, setTitulo] = useState(TITULO_DEFAULT)
  const [publico, setPublico] = useState(false)
  const [animeSlug, setAnimeSlug] = useState('')
  const [selectedAnime, setSelectedAnime] = useState('')
  const [rows, setRows] = useState(createEmptyRows)
  const [current, setCurrent] = useState(null)
  const [dragging, setDragging] = useState(null)

  useSeo({
    title: 'Tier lists anime — AnimeShowdown',
    description: 'Crea, guarda y comparte tier lists de personajes anime.',
    canonical: 'https://animeshowdown.dev/tier-lists',
  })

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
    setRows((prev) => ({
      ...prev,
      BANCA: [...prev.BANCA, personaje],
    }))
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
    setRows((prev) => ({
      ...prev,
      BANCA: [...prev.BANCA, ...disponibles],
    }))
    setAnimeSlug(slugifyAnime(selectedAnime))
    if (titulo === TITULO_DEFAULT) {
      setTitulo(`Tier list de ${selectedAnime}`)
    }
  }

  const quitarSlug = (slug) => {
    setRows((prev) => removeSlug(prev, slug))
  }

  const moverSlug = (slug, targetTier, targetIndex) => {
    setRows((prev) => moveSlug(prev, slug, targetTier, targetIndex))
  }

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
    <section className="px-5 py-8 sm:px-8 sm:py-12">
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
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-3 py-1 text-[12px] font-black text-gold">
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              Tier lists
            </span>
            <h1 className="text-3xl font-black tracking-tight text-fg-strong sm:text-4xl">
              Tier list creator
            </h1>
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
            <section className="grid gap-3 border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5">
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
            </section>

            <section className="border border-border bg-surface p-2 sm:p-3">
              <div className="flex flex-col gap-2">
                {TIERS.map((tier) => (
                  <TierRow
                    key={tier}
                    tier={tier}
                    items={rows[tier]}
                    dragging={dragging}
                    onDragStart={(slug) => setDragging({ slug })}
                    onDragEnd={() => setDragging(null)}
                    onDrop={(slug, targetTier, targetIndex) => {
                      moverSlug(slug, targetTier, targetIndex)
                      setDragging(null)
                    }}
                    onRemove={quitarSlug}
                  />
                ))}
              </div>
            </section>

            <TierListCanvasPreview
              titulo={titulo}
              rows={rows}
              publicSlug={sharePath ? current.slug : null}
            />
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <section className="border border-border bg-surface p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-black text-fg-muted">
                Añadir personaje
              </h2>
              <AutocompletePersonaje
                onSelect={addSlug}
                placeholder="Busca personaje"
                filtroExtra={(p) => !ocupados.has(p.slug)}
              />
            </section>

            <section className="border border-border bg-surface p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-black text-fg-muted">
                Plantilla
              </h2>
              <div className="flex gap-2">
                <select
                  value={selectedAnime}
                  onChange={(e) => setSelectedAnime(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm font-semibold text-fg-strong outline-none focus:border-accent/55"
                >
                  <option value="">Vacía</option>
                  {animes.map((anime) => (
                    <option key={anime} value={anime}>
                      {anime}
                    </option>
                  ))}
                </select>
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
              <section className="border border-gold/35 bg-gold-soft p-4 sm:p-5">
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

            <section className="border border-border bg-surface p-4 sm:p-5">
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
                      <span className="shrink-0 text-[11px] font-black text-gold">
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
    </section>
  )
}

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
    <section className="px-5 py-8 sm:px-8 sm:py-12">
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
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-3 py-1 text-[12px] font-black text-gold">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            @{tierList.username}
          </span>
          <h1 className="text-3xl font-black tracking-tight text-fg-strong sm:text-4xl">
            {tierList.titulo}
          </h1>
        </header>
        <section className="border border-border bg-surface p-2 sm:p-3">
          <div className="flex flex-col gap-2">
            {TIERS.map((tier) => (
              <TierRow
                key={tier}
                tier={tier}
                items={rows[tier]}
                readOnly
              />
            ))}
          </div>
        </section>
        <TierListCanvasPreview
          titulo={tierList.titulo}
          rows={rows}
          publicSlug={tierList.slug}
        />
      </div>
    </section>
  )
}

function TierRow({
  tier,
  items,
  readOnly = false,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onRemove,
}) {
  const canDrop = !readOnly && dragging?.slug
  const allowDrop = (event) => {
    if (!canDrop) return
    event.preventDefault()
  }
  const dropAt = (index) => (event) => {
    if (!canDrop) return
    event.preventDefault()
    event.stopPropagation()
    onDrop(dragging.slug, tier, index)
  }

  return (
    <div className="grid min-h-[7.5rem] grid-cols-[3.5rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-bg sm:grid-cols-[4.25rem_minmax(0,1fr)]">
      <div className="flex items-center justify-center border-r border-border bg-surface/80 text-xl font-black text-gold sm:text-2xl">
        {TIER_LABEL[tier]}
      </div>
      <div
        className="flex min-h-[7.5rem] flex-wrap content-start gap-2 p-2"
        onDragOver={allowDrop}
        onDrop={dropAt(items.length)}
      >
        {items.length === 0 ? (
          <span className="flex min-h-24 items-center px-2 text-sm text-fg-muted">
            Vacío
          </span>
        ) : (
          items.map((personaje, index) => (
            <TierCard
              key={personaje.slug}
              personaje={personaje}
              readOnly={readOnly}
              onDragStart={() => onDragStart?.(personaje.slug)}
              onDragEnd={onDragEnd}
              onDrop={dropAt(index)}
              onRemove={() => onRemove?.(personaje.slug)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TierCard({ personaje, readOnly, onDragStart, onDragEnd, onDrop, onRemove }) {
  return (
    <article
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!readOnly) event.preventDefault()
      }}
      onDrop={onDrop}
      className="group relative flex h-28 w-20 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-surface text-left shadow-sm transition-colors hover:border-accent/45 sm:h-32 sm:w-24"
    >
      <PersonajeImg
        slug={personaje.slug}
        src={personaje.imagenUrl ?? personaje.imagen}
        alt={personaje.nombre}
        nombre={personaje.nombre}
        imagenColorDominante={personaje.imagenColorDominante}
        loading="lazy"
        sizes="96px"
        className="h-[4.6rem] w-full object-cover object-top sm:h-[5.5rem]"
      />
      <div className="min-h-0 flex-1 px-2 py-1">
        <p className="line-clamp-2 text-[11px] font-black leading-3 text-fg-strong">
          {personaje.nombre}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-fg-muted">
          {personaje.anime}
        </p>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-bg/90 text-fg-muted opacity-0 transition-opacity hover:text-fg-strong group-hover:opacity-100 focus:opacity-100"
          aria-label={`Quitar ${personaje.nombre}`}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </article>
  )
}

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
