import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Lock, Save, Search, ShieldCheck, Sparkles, Trophy, WalletCards, X } from 'lucide-react'
import { toast } from 'sonner'
import { useSeo } from '../hooks/useSeo'
import { useAuth } from '../contexts/AuthContext'
import { endpoints } from '../lib/api'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import PersonajeImg from '../components/PersonajeImg'
import Avatar from '../components/Avatar'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

function normalizarItems(items = []) {
  return items.map((item) => ({
    personajeId: item.personajeId ?? item.id,
    id: item.personajeId ?? item.id,
    slug: item.slug,
    nombre: item.nombre,
    anime: item.anime,
    imagenUrl: item.imagenUrl,
    coste: Number(item.coste ?? 0),
    deltaSemanal: Number(item.deltaSemanal ?? 0),
  }))
}

function FantasyPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [draftIds, setDraftIds] = useState(null)
  const [draftCache, setDraftCache] = useState({})

  useSeo({
    title: 'Fantasy Showdown',
    description:
      'Draftea cinco personajes anime con presupuesto semanal y compite por su movimiento en el ranking de AnimeShowdown.',
  })

  const resumenQuery = useQuery({
    queryKey: ['fantasy', 'me'],
    queryFn: () => endpoints.fantasyMe(),
    enabled: Boolean(user),
    staleTime: 30_000,
  })
  const resumen = resumenQuery.data
  const equipo = resumen?.equipo
  const equipoItems = useMemo(() => normalizarItems(equipo?.items), [equipo?.items])
  const equipoIds = useMemo(() => equipoItems.map((item) => item.personajeId), [equipoItems])
  const selectedIds = draftIds ?? equipoIds

  const candidatosQuery = useQuery({
    queryKey: ['fantasy', 'candidatos', search],
    queryFn: () => endpoints.fantasyCandidatos({ q: search.trim(), limit: search.trim() ? 60 : 120 }),
    enabled: Boolean(user),
    staleTime: 45_000,
  })
  const candidatos = useMemo(() => normalizarItems(candidatosQuery.data), [candidatosQuery.data])

  const itemById = useMemo(() => {
    const map = new Map()
    for (const item of equipoItems) map.set(item.personajeId, item)
    for (const item of Object.values(draftCache)) map.set(item.personajeId, item)
    for (const item of candidatos) map.set(item.personajeId, item)
    return map
  }, [candidatos, draftCache, equipoItems])

  const selectedItems = selectedIds.map((id) => itemById.get(id)).filter(Boolean)
  const presupuesto = Number(resumen?.presupuesto ?? equipo?.presupuesto ?? 1000)
  const slots = Number(resumen?.slots ?? 5)
  const costeTotal = selectedItems.reduce((acc, item) => acc + Number(item.coste || 0), 0)
  const restante = presupuesto - costeTotal
  const hasChanges = selectedIds.join(',') !== equipoIds.join(',')
  const locked = Boolean(equipo?.locked)
  const canSave = !locked && selectedIds.length === slots && restante >= 0 && hasChanges
  const canLock = Boolean(equipo) && !locked && equipoItems.length === slots

  const guardarMutation = useMutation({
    mutationFn: () => endpoints.fantasyGuardarEquipo(selectedIds),
    onSuccess: () => {
      setDraftIds(null)
      setDraftCache({})
      queryClient.invalidateQueries({ queryKey: ['fantasy'] })
      toast.success('Equipo guardado')
    },
    onError: (error) => {
      toast.error(error?.message || 'No se pudo guardar el equipo')
    },
  })

  const lockMutation = useMutation({
    mutationFn: () => endpoints.fantasyBloquearEquipo(),
    onSuccess: () => {
      setDraftIds(null)
      setDraftCache({})
      queryClient.invalidateQueries({ queryKey: ['fantasy'] })
      toast.success('Equipo bloqueado')
    },
    onError: (error) => {
      toast.error(error?.message || 'No se pudo bloquear el equipo')
    },
  })

  const leaderboardQuery = useQuery({
    queryKey: ['fantasy', 'leaderboard', resumen?.semanaIso],
    queryFn: () => endpoints.fantasyLeaderboard({ semanaIso: resumen?.semanaIso, limit: 20 }),
    staleTime: 60_000,
  })

  const togglePersonaje = (personaje) => {
    if (locked) return
    const id = personaje.personajeId
    setDraftCache((prev) => ({ ...prev, [id]: personaje }))
    const base = draftIds ?? equipoIds
    if (base.includes(id)) {
      setDraftIds(base.filter((value) => value !== id))
      return
    }
    if (base.length >= slots) {
      toast.info('Ya tienes cinco slots ocupados')
      return
    }
    setDraftIds([...base, id])
  }

  const quitarSlot = (id) => {
    if (locked) return
    const base = draftIds ?? equipoIds
    setDraftIds(base.filter((value) => value !== id))
  }

  return (
    <VisualPageShell visual={BRAND_VISUALS.ranking} contentClassName="mx-auto max-w-7xl" lateralKanji={{ left: '編', right: '隊' }} atmosphere="arena">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Fantasy Showdown', path: '/fantasy' },
        ])}
      />

      <header className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            Semana {resumen?.semanaIso ?? 'activa'}
          </span>
          <h1 className="mt-3 text-[clamp(2.2rem,6vw,4.6rem)] leading-none tracking-tight">
            Fantasy <span className="as-title-gradient">Showdown</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-fg-muted sm:text-base">
            Cinco slots, presupuesto cerrado y puntos por movimiento semanal en el ranking.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[26rem]">
          <Kpi icon={WalletCards} label="Presupuesto" value={presupuesto} />
          <Kpi icon={ShieldCheck} label="Restante" value={restante} tone={restante < 0 ? 'danger' : 'gold'} />
          <Kpi icon={Trophy} label="Puntos" value={equipo?.puntos ?? 0} />
        </div>
      </header>

      {!user && (
        <EmptyState
          scene
          icon={Lock}
          title="Entra para draftear"
          action={{ to: '/login?next=/fantasy', label: 'Login' }}
        >
          Fantasy Showdown guarda un equipo semanal por cuenta.
        </EmptyState>
      )}

      {user && resumenQuery.isLoading && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)]">
          <Skeleton variant="card" className="h-[34rem] rounded-lg" />
          <Skeleton variant="card" className="h-[34rem] rounded-lg" />
        </div>
      )}

      {user && resumenQuery.isError && (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar Fantasy"
          action={
            <button type="button" onClick={() => resumenQuery.refetch()} className="as-button-primary rounded-lg px-5 py-3 text-sm font-black">
              Reintentar
            </button>
          }
        />
      )}

      {user && !resumenQuery.isLoading && !resumenQuery.isError && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(23rem,0.85fr)]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-fg-strong">Draft</h2>
                <p className="text-[13px] text-fg-muted">
                  {selectedIds.length}/{slots} slots · coste {costeTotal}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => guardarMutation.mutate()}
                  disabled={!canSave || guardarMutation.isPending}
                  className="as-button-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => lockMutation.mutate()}
                  disabled={!canLock || lockMutation.isPending}
                  className="as-button-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Lock className="h-4 w-4" />
                  Bloquear
                </button>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Array.from({ length: slots }).map((_, index) => {
                const item = selectedItems[index]
                return (
                  <DraftSlot
                    key={item?.personajeId ?? `slot-${index}`}
                    item={item}
                    index={index}
                    locked={locked}
                    onRemove={quitarSlot}
                  />
                )
              })}
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
              <Search className="h-4 w-4 text-fg-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar personaje o anime"
                className="min-w-0 flex-1 bg-transparent text-sm text-fg-strong outline-none placeholder:text-fg-muted"
              />
            </div>

            {candidatosQuery.isLoading && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <Skeleton key={index} variant="card" className="h-36 rounded-lg" />
                ))}
              </div>
            )}

            {!candidatosQuery.isLoading && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {candidatos.map((personaje) => (
                  <CandidateCard
                    key={personaje.personajeId}
                    personaje={personaje}
                    selected={selectedIds.includes(personaje.personajeId)}
                    locked={locked}
                    onToggle={togglePersonaje}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="min-w-0 space-y-5">
            <section className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-fg-strong">Mi equipo</h2>
                  <p className="text-[12px] text-fg-muted">
                    {locked ? 'Bloqueado' : 'Editable'} · semana {resumen?.semanaIso}
                  </p>
                </div>
                {locked && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-1 text-[11px] font-bold text-gold">
                    <Lock className="h-3 w-3" />
                    LOCK
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {equipoItems.length === 0 && (
                  <p className="rounded-lg border border-border bg-surface-alt px-4 py-3 text-sm text-fg-muted">
                    Sin equipo guardado todavía.
                  </p>
                )}
                {equipoItems.map((item) => (
                  <MiniRosterRow key={item.personajeId} item={item} />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-surface p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-fg-strong">Leaderboard</h2>
                <Link to="/ranking" className="text-[12px] font-bold text-gold hover:underline">
                  Ranking ELO
                </Link>
              </div>
              {leaderboardQuery.isLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} variant="line" className="h-12 rounded-lg" />
                  ))}
                </div>
              )}
              {!leaderboardQuery.isLoading && (!leaderboardQuery.data || leaderboardQuery.data.length === 0) && (
                <p className="rounded-lg border border-border bg-surface-alt px-4 py-3 text-sm text-fg-muted">
                  Aún no hay equipos bloqueados.
                </p>
              )}
              {!leaderboardQuery.isLoading && leaderboardQuery.data?.length > 0 && (
                <ol className="space-y-2">
                  {leaderboardQuery.data.map((entry) => (
                    <LeaderboardRow key={`${entry.posicion}-${entry.username}`} entry={entry} />
                  ))}
                </ol>
              )}
            </section>
          </aside>
        </div>
      )}
    </VisualPageShell>
  )
}

function Kpi({ icon: Icon, label, value, tone = 'default' }) {
  const valueClass = tone === 'danger' ? 'text-danger' : tone === 'gold' ? 'text-gold' : 'text-fg-strong'
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-fg-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`font-mono text-2xl font-black tabular-nums ${valueClass}`}>{value}</p>
    </div>
  )
}

function DraftSlot({ item, index, locked, onRemove }) {
  if (!item) {
    return (
      <div className="flex aspect-[2/3] items-center justify-center rounded-lg border border-dashed border-border bg-surface-alt text-[12px] font-bold uppercase tracking-[0.08em] text-fg-muted">
        Slot {index + 1}
      </div>
    )
  }

  return (
    <div className="group relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface">
      <PersonajeImg
        slug={item.slug}
        src={item.imagenUrl}
        nombre={item.nombre}
        alt={item.nombre}
        className="h-full w-full"
        sizes="(min-width: 1024px) 170px, 42vw"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/80 to-transparent p-3">
        <p className="line-clamp-2 text-sm font-black text-fg-strong">{item.nombre}</p>
        <p className="mt-1 text-[11px] text-fg-muted">{item.coste} pts · Δ {item.deltaSemanal}</p>
      </div>
      {!locked && (
        <button
          type="button"
          onClick={() => onRemove(item.personajeId)}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg/80 text-fg-muted opacity-100 transition-colors hover:text-fg-strong"
          aria-label={`Quitar ${item.nombre}`}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function CandidateCard({ personaje, selected, locked, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(personaje)}
      disabled={locked}
      className={`grid min-h-36 grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-lg border bg-surface p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        selected ? 'border-gold shadow-aura' : 'border-border hover:border-accent/60'
      }`}
    >
      <PersonajeImg
        slug={personaje.slug}
        src={personaje.imagenUrl}
        nombre={personaje.nombre}
        alt={personaje.nombre}
        className="aspect-[2/3] h-32 w-20 rounded-md"
        sizes="80px"
      />
      <span className="flex min-w-0 flex-col justify-between py-1">
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm font-black text-fg-strong">{personaje.nombre}</span>
          <span className="mt-1 block truncate text-[12px] text-fg-muted">{personaje.anime}</span>
        </span>
        <span className="grid grid-cols-3 gap-1 text-[11px] font-bold">
          <span className="rounded-md bg-surface-alt px-2 py-1 text-fg-muted">
            ELO {personaje.eloEstimado}
          </span>
          <span className="rounded-md bg-surface-alt px-2 py-1 text-gold">
            {personaje.coste}
          </span>
          <span className="rounded-md bg-surface-alt px-2 py-1 text-fg-muted">
            Δ {personaje.deltaSemanal}
          </span>
        </span>
      </span>
    </button>
  )
}

function MiniRosterRow({ item }) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface-alt p-2">
      <PersonajeImg
        slug={item.slug}
        src={item.imagenUrl}
        nombre={item.nombre}
        alt={item.nombre}
        className="h-10 w-10 rounded-md"
        sizes="40px"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-fg-strong">{item.nombre}</p>
        <p className="truncate text-[11px] text-fg-muted">{item.anime}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-black text-gold">{item.deltaSemanal}</p>
        <p className="text-[10px] uppercase text-fg-muted">delta</p>
      </div>
    </div>
  )
}

function LeaderboardRow({ entry }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface-alt p-3">
      <span className="font-mono text-sm font-black text-gold">#{entry.posicion}</span>
      <span className="flex min-w-0 items-center gap-2">
        <Avatar user={{ username: entry.username, avatarUrl: entry.avatarUrl }} size={32} />
        <Link to={`/u/${encodeURIComponent(entry.username)}`} className="truncate text-sm font-bold text-fg-strong hover:underline">
          {entry.username}
        </Link>
      </span>
      <span className="font-mono text-base font-black text-fg-strong">{entry.puntos}</span>
    </li>
  )
}

export default FantasyPage
