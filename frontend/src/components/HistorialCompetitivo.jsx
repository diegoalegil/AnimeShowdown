import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity,
  Clock,
  History,
  Minus,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { endpoints, ApiError } from '../lib/api'
import { imagenPersonaje } from '../lib/personajes-core'
import { ocultaImgRota } from '../lib/imgFallback'
import { useVotosPeriodo } from '../hooks/useVotosPeriodo'

/**
 * Historial competitivo de un personaje (Plan producto 2026-05-18 —
 * visión estadio otaku). Dos secciones que viven al final de la ficha:
 *
 *   1. Últimos duelos: timeline compacto de enfrentamientos recientes
 *      con rival, resultado y fecha relativa.
 *   2. Contra quién: 3 mini-listas (mejores, peores, frecuentes) con
 *      cuenta de W/L por rival.
 *
 * Ambas son lazy en el sentido de datos — solo se piden cuando el
 * componente se monta. React Query cachea 60s para que navegar entre
 * fichas no spamee la API.
 */
const STALE = 60 * 1000

function useDuelos(slug) {
  return useQuery({
    queryKey: ['historial', slug, 'duelos'],
    queryFn: () => endpoints.duelosRecientesPersonaje(slug, { limit: 10 }),
    enabled: Boolean(slug),
    staleTime: STALE,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  })
}

function useMatchups(slug) {
  return useQuery({
    queryKey: ['historial', slug, 'matchups'],
    queryFn: () => endpoints.matchupsPersonaje(slug),
    enabled: Boolean(slug),
    staleTime: STALE,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  })
}

function HistorialCompetitivo({ slug, nombre }) {
  return (
    <div className="mt-16 flex flex-col gap-8">
      {/* Actividad reciente full-width arriba — 1 línea visual rápida
          que da contexto temporal antes de bajar a duelos/matchups. */}
      <ActividadReciente slug={slug} nombre={nombre} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr]">
        <UltimosDuelos slug={slug} nombre={nombre} />
        <ContraQuien slug={slug} nombre={nombre} />
      </div>
    </div>
  )
}

/**
 * Banner "Actividad reciente" (sprint 2026-05-18). Pinta votos del
 * último periodo + delta vs periodo anterior, con tono según signo.
 * Empty state limpio cuando no hay actividad.
 */
function ActividadReciente({ slug, nombre }) {
  const { data, isLoading, isError } = useVotosPeriodo(slug, { dias: 7 })

  if (isError) return null
  if (isLoading) return <ActividadSkeleton />

  const actual = data?.votosPeriodoActual ?? 0
  const anterior = data?.votosPeriodoAnterior ?? 0
  const delta = data?.delta ?? 0
  const tieneActividad = actual > 0 || anterior > 0

  if (!tieneActividad) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-fg-muted">
          <Activity className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
            Actividad reciente
          </p>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {nombre} aún no recibe votos esta semana. Vota por él para
            empezar a moverlo en el ranking.
          </p>
        </div>
        <Link
          to="/votar"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-[12px] font-semibold text-fg-strong hover:border-accent hover:text-accent"
        >
          Vota ahora
        </Link>
      </div>
    )
  }

  const subio = delta > 0
  const bajo = delta < 0
  const tonoBorde = subio
    ? 'border-emerald-500/30 bg-emerald-500/5'
    : bajo
      ? 'border-rose-500/30 bg-rose-500/5'
      : 'border-border bg-surface/60'
  const tonoIcono = subio
    ? 'bg-emerald-500/15 text-emerald-300'
    : bajo
      ? 'bg-rose-500/15 text-rose-300'
      : 'bg-surface-alt text-fg-muted'
  const DeltaIcon = subio ? TrendingUp : bajo ? TrendingDown : Minus
  const deltaTexto = delta === 0
    ? 'Mismo ritmo que la semana pasada'
    : `${subio ? '+' : ''}${delta} vs la semana pasada`

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5 ${tonoBorde}`}>
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tonoIcono}`}>
        <Activity className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
          Actividad reciente · últimos 7 días
        </p>
        <p className="mt-0.5 text-[15px] font-bold text-fg-strong">
          <span className="font-mono tabular-nums">{actual.toLocaleString('es-ES')}</span>{' '}
          {actual === 1 ? 'voto' : 'votos'}
        </p>
      </div>
      <div className="inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-bg/40 px-2.5 py-1 sm:self-auto">
        <DeltaIcon className={`h-3.5 w-3.5 ${subio ? 'text-emerald-300' : bajo ? 'text-rose-300' : 'text-fg-muted'}`} />
        <span className={`font-mono text-[12px] font-bold tabular-nums ${subio ? 'text-emerald-300' : bajo ? 'text-rose-300' : 'text-fg-muted'}`}>
          {deltaTexto}
        </span>
      </div>
    </div>
  )
}

function ActividadSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-xl border border-border bg-surface/40 p-4 sm:p-5" aria-hidden="true">
      <div className="h-10 w-10 rounded-lg bg-surface-alt" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 w-1/4 rounded bg-surface-alt" />
        <div className="h-3 w-1/3 rounded bg-surface-alt" />
      </div>
      <div className="h-6 w-32 rounded bg-surface-alt" />
    </div>
  )
}

function UltimosDuelos({ slug, nombre }) {
  const { data, isLoading, isError } = useDuelos(slug)
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-2 border-b border-border pb-2">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
            <History className="h-3 w-3 text-accent" />
            Historial
          </span>
          <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
            Últimos duelos
          </h2>
        </div>
      </div>
      {isLoading && <DuelosSkeleton />}
      {isError && (
        <p className="rounded-lg border border-border bg-surface p-4 text-[13px] text-fg-muted">
          No se pudo cargar el historial. Inténtalo más tarde.
        </p>
      )}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyHistorial nombre={nombre} />
      )}
      {!isLoading && !isError && data && data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.map((d) => (
            <DueloRow key={d.enfrentamientoId} duelo={d} />
          ))}
        </ul>
      )}
    </section>
  )
}

const RESULTADO_STYLE = {
  WIN: {
    label: 'Victoria',
    chip: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200',
    Icon: Trophy,
  },
  LOSS: {
    label: 'Derrota',
    chip: 'bg-rose-500/15 border-rose-500/40 text-rose-200',
    Icon: TrendingDown,
  },
  PENDING: {
    label: 'Pendiente',
    chip: 'bg-surface-alt border-border text-fg-muted',
    Icon: Clock,
  },
}

function DueloRow({ duelo }) {
  const { rival, resultado, fecha, torneoNombre, torneoSlug } = duelo
  const style = RESULTADO_STYLE[resultado] ?? RESULTADO_STYLE.PENDING
  const Icon = style.Icon
  return (
    <li className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent/40">
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${style.chip}`}
        title={style.label}
        aria-label={style.label}
      >
        <Icon className="h-4 w-4" />
      </span>
      {rival ? (
        <Link to={`/personajes/${rival.slug}`} className="shrink-0">
          <img
            src={rival.imagenUrl || imagenPersonaje(rival.slug)}
            alt=""
            loading="lazy"
            onError={ocultaImgRota}
            className="h-12 w-9 rounded object-cover object-top"
          />
        </Link>
      ) : (
        <div className="h-12 w-9 shrink-0 rounded bg-surface-alt" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[13px] font-semibold text-fg-strong">
          <span className="text-fg-muted">vs </span>
          {rival ? (
            <Link
              to={`/personajes/${rival.slug}`}
              className="hover:text-accent"
            >
              {rival.nombre}
            </Link>
          ) : (
            <span className="italic text-fg-muted">por asignar</span>
          )}
        </p>
        <p className="line-clamp-1 text-[11px] text-fg-muted">
          {rival?.anime && <>{rival.anime} · </>}
          {formatRelativo(fecha)}
          {torneoNombre && torneoSlug && (
            <>
              {' · '}
              <Link
                to={`/torneos/${torneoSlug}`}
                className="hover:text-accent hover:underline"
              >
                {torneoNombre}
              </Link>
            </>
          )}
        </p>
      </div>
    </li>
  )
}

function DuelosSkeleton() {
  return (
    <ul className="flex animate-pulse flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
        >
          <div className="h-9 w-9 rounded-md bg-surface-alt" />
          <div className="h-12 w-9 rounded bg-surface-alt" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 rounded bg-surface-alt" />
            <div className="h-2.5 w-1/2 rounded bg-surface-alt" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function EmptyHistorial({ nombre }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface/40 p-6 text-center">
      <Swords className="h-7 w-7 text-fg-muted" />
      <p className="text-[14px] font-semibold text-fg-strong">
        Sin duelos todavía
      </p>
      <p className="max-w-xs text-[12px] text-fg-muted">
        {nombre} aún no ha competido. Cuando entre en un torneo o reciba
        votos, su historial empezará a aparecer aquí.
      </p>
      <Link
        to="/votar"
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover"
      >
        <Swords className="h-3.5 w-3.5" />
        Vota duelos abiertos
      </Link>
    </div>
  )
}

function ContraQuien({ slug, nombre }) {
  const { data, isLoading, isError } = useMatchups(slug)
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-2 border-b border-border pb-2">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
            <Swords className="h-3 w-3 text-accent" />
            Matchups
          </span>
          <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
            Contra quién
          </h2>
        </div>
      </div>
      {isLoading && <MatchupsSkeleton />}
      {isError && (
        <p className="rounded-lg border border-border bg-surface p-4 text-[13px] text-fg-muted">
          No se pudieron cargar los matchups.
        </p>
      )}
      {!isLoading && !isError && data && (
        <ContraQuienBody data={data} nombre={nombre} />
      )}
    </section>
  )
}

function ContraQuienBody({ data, nombre }) {
  // Threshold bajo: con menos de 3 duelos resueltos el agregado no
  // dice nada interesante (rival único, etc) — mostramos empty estado.
  if (data.totalEnfrentamientos < 3) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface/40 p-6 text-center">
        <Minus className="h-6 w-6 text-fg-muted" />
        <p className="text-[14px] font-semibold text-fg-strong">
          Aún necesita más duelos
        </p>
        <p className="max-w-xs text-[12px] text-fg-muted">
          Con {data.totalEnfrentamientos}{' '}
          {data.totalEnfrentamientos === 1 ? 'duelo resuelto' : 'duelos resueltos'}{' '}
          aún no hay matchups significativos. Vota más para destapar a
          quién se le da mejor o peor {nombre}.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <MatchupGroup
        titulo="Gana más contra"
        items={data.mejoresMatchups}
        tipo="WIN"
      />
      <MatchupGroup
        titulo="Pierde más contra"
        items={data.peoresMatchups}
        tipo="LOSS"
      />
      <MatchupGroup
        titulo="Rivales frecuentes"
        items={data.rivalesFrecuentes}
        tipo="FREQ"
      />
      <p className="text-[11px] text-fg-muted">
        Agregado sobre {data.totalEnfrentamientos} duelos resueltos.
      </p>
    </div>
  )
}

const GROUP_STYLE = {
  WIN: { Icon: TrendingUp, color: 'text-emerald-300' },
  LOSS: { Icon: TrendingDown, color: 'text-rose-300' },
  FREQ: { Icon: Swords, color: 'text-fg-muted' },
}

function MatchupGroup({ titulo, items, tipo }) {
  const style = GROUP_STYLE[tipo] ?? GROUP_STYLE.FREQ
  const Icon = style.Icon
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className={`mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${style.color}`}>
          <Icon className="h-3 w-3" />
          {titulo}
        </div>
        <p className="text-[12px] text-fg-muted">Sin datos aún.</p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className={`mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${style.color}`}>
        <Icon className="h-3 w-3" />
        {titulo}
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((m, idx) => (
          <MatchupRow key={`${m.rival?.slug}-${idx}`} item={m} tipo={tipo} />
        ))}
      </ul>
    </div>
  )
}

function MatchupRow({ item, tipo }) {
  const { rival, wins, losses } = item
  const total = wins + losses
  if (!rival) return null
  // Texto principal según el tipo de bloque: enfatiza el dato relevante
  // (wins en mejores, losses en peores, total en frecuentes).
  const stat =
    tipo === 'WIN'
      ? `${wins}W`
      : tipo === 'LOSS'
        ? `${losses}L`
        : `${total} duelos`
  const statClase =
    tipo === 'WIN'
      ? 'text-emerald-300'
      : tipo === 'LOSS'
        ? 'text-rose-300'
        : 'text-fg-strong'
  return (
    <li className="flex items-center gap-2">
      <Link to={`/personajes/${rival.slug}`} className="shrink-0">
        <img
          src={rival.imagenUrl || imagenPersonaje(rival.slug)}
          alt=""
          loading="lazy"
          onError={ocultaImgRota}
          className="h-7 w-5 rounded object-cover object-top"
        />
      </Link>
      <Link
        to={`/personajes/${rival.slug}`}
        className="line-clamp-1 min-w-0 flex-1 text-[12px] font-semibold text-fg-strong hover:text-accent"
      >
        {rival.nombre}
      </Link>
      <span className={`font-mono text-[12px] font-bold tabular-nums ${statClase}`}>
        {stat}
      </span>
      <span className="font-mono text-[10px] text-fg-muted tabular-nums">
        {wins}-{losses}
      </span>
    </li>
  )
}

function MatchupsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-3 h-3 w-1/3 rounded bg-surface-alt" />
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-2">
                <div className="h-7 w-5 rounded bg-surface-alt" />
                <div className="h-3 flex-1 rounded bg-surface-alt" />
                <div className="h-3 w-10 rounded bg-surface-alt" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function formatRelativo(isoString) {
  if (!isoString) return ''
  try {
    const fecha = new Date(isoString)
    const segs = Math.floor((Date.now() - fecha.getTime()) / 1000)
    if (segs < 60) return 'ahora mismo'
    const min = Math.floor(segs / 60)
    if (min < 60) return `hace ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `hace ${h} h`
    const d = Math.floor(h / 24)
    if (d < 7) return `hace ${d} d`
    return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export default HistorialCompetitivo
