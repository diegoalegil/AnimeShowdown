import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Heart,
  Minus,
  Sparkles,
  Swords,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { endpoints } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useMisFavoritos } from '../hooks/useFavoritos'
import { useVotosPeriodoBatch } from '../hooks/useVotosPeriodo'
import PersonajeImg from './PersonajeImg'

/**
 * Banner de Pulso personalizado por usuario logueado. Cruza el roster
 * del user (useMisFavoritos) con los
 * movimientos de la última semana (rankingMovimientos) — sin pegar al
 * backend para esto, ambas queries ya viven en cache global desde Pulso.
 *
 * <p>3 estados visibles para usuarios logueados:
 *   1. Sin favoritos → empty state sutil "Sigue personajes para ver tu
 *      pulso personalizado" + CTA a /personajes.
 *   2. Con favoritos + intersección con movers → "Tus favoritos se
 *      movieron" + lista compacta con avatares y ↑↓.
 *   3. Con favoritos pero ninguno movió esta semana → "Tu roster está
 *      estable" + CTA a /votar para alimentar el ranking.
 *
 * <p>Para usuarios NO logueados → return null. Decisión: mantener Pulso
 * limpio para invitados. El CTA para "guarda tu roster" ya vive en la
 * ficha de personaje (botón Heart ghost que invita a /login?next=).
 *
 * <p>Reutiliza la misma queryKey ['pulso', 'movimientos', 7] que
 * SectionPulso para evitar requests duplicadas — limit 100 cubre la
 * mayoría de slugs que un usuario casual puede tener en su roster.
 */
function FavoritosPulsoBanner() {
  const { user } = useAuth()
  const { data: favoritos, isLoading: favLoading, isError: favError } = useMisFavoritos()
  // Reuso del cache de Pulso. Si Pulso ya cargó la query, este hook
  // devuelve los datos al instante; si no, dispara fetch.
  const { data: movimientos } = useQuery({
    queryKey: ['pulso', 'movimientos', 7],
    queryFn: () => endpoints.rankingMovimientos({ dias: 7, limit: 100 }),
    staleTime: 60 * 1000,
    enabled: Boolean(user),
  })

  const slugsFavoritos = useMemo(
    () => (favoritos ?? []).map((f) => f.slug),
    [favoritos],
  )
  // Actividad reciente: 1 batch request por la
  // lista de favoritos para enriquecer cada slug con su delta de
  // votos. Si un favorito no movió ELO pero recibió votos, igual
  // aparece como "actividad" en vez de quedarse fuera.
  const { bySlug: votosBySlug } = useVotosPeriodoBatch(slugsFavoritos, { dias: 7 })

  const movidos = useMemo(() => {
    if (!favoritos || favoritos.length === 0) return []
    const mapMovs = new Map((movimientos || []).map((m) => [m.slug, m]))
    return favoritos
      .map((f) => ({
        favorito: f,
        movimiento: mapMovs.get(f.slug),
        actividad: votosBySlug.get(f.slug),
      }))
      .filter(
        ({ movimiento }) =>
          movimiento &&
          movimiento.delta != null &&
          movimiento.delta !== 0,
      )
      .sort(
        (a, b) =>
          Math.abs(b.movimiento.delta) - Math.abs(a.movimiento.delta),
      )
      .slice(0, 5)
  }, [favoritos, movimientos, votosBySlug])

  // Favoritos sin movimiento ELO pero CON votos esta semana — "activos
  // sin cambio de puesto". Solo aparecen si NO hay movs (caso BannerEstable).
  const activosSinMov = useMemo(() => {
    if (!favoritos || favoritos.length === 0) return []
    return favoritos
      .map((f) => ({ favorito: f, actividad: votosBySlug.get(f.slug) }))
      .filter(({ actividad }) => actividad && actividad.votosPeriodoActual > 0)
      .sort((a, b) => b.actividad.votosPeriodoActual - a.actividad.votosPeriodoActual)
      .slice(0, 5)
  }, [favoritos, votosBySlug])

  if (!user) return null
  if (favLoading) return <BannerSkeleton />
  // Si la query de favoritos falló, ocultamos el banner en vez de mostrar el
  // estado "sigue personajes" (que daría a entender, en falso, que no sigues a
  // nadie). Es secundario, así que no vale la pena un estado de error propio.
  if (favError) return null

  const totalFavoritos = favoritos?.length ?? 0
  if (totalFavoritos === 0) return <BannerSinFavoritos />
  if (movidos.length > 0) return <BannerConMovs items={movidos} total={totalFavoritos} />
  if (activosSinMov.length > 0) return <BannerConActividad items={activosSinMov} total={totalFavoritos} />
  return <BannerEstable total={totalFavoritos} />
}

function BannerWrapper({ children, tono = 'roster' }) {
  const tonos = {
    roster: 'border-gold/30 bg-gradient-to-br from-gold/14 via-accent/8 to-transparent',
    emerald: 'border-success/30 bg-gradient-to-br from-success/10 via-success/5 to-transparent',
    surface: 'border-border bg-surface/60',
  }
  return (
    <div className={`mb-3 rounded-xl border p-4 sm:mb-4 sm:p-5 ${tonos[tono]}`}>
      {children}
    </div>
  )
}

function BannerSinFavoritos() {
  return (
    <BannerWrapper tono="surface">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/12 text-gold">
            <Heart className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-fg-strong">
              Sigue personajes para ver tu pulso personalizado
            </p>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              Cuando tu roster se mueva en el ranking, aparecerá aquí.
            </p>
          </div>
        </div>
        <Link
          to="/personajes"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/8 px-3 py-1.5 text-[12px] font-semibold text-gold hover:bg-gold/14"
        >
          <Sparkles className="h-3 w-3" />
          Explorar catálogo
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </BannerWrapper>
  )
}

function BannerEstable({ total }) {
  return (
    <BannerWrapper tono="emerald">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
            <Minus className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-fg-strong">
              Tu roster está estable
            </p>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              Ninguno de tus {total}{' '}
              {total === 1 ? 'favorito' : 'favoritos'} se movió en el
              ranking esta semana. Sigue votando para cambiar el meta.
            </p>
          </div>
        </div>
        <Link
          to="/votar"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-[12px] font-semibold text-success hover:bg-success/20"
        >
          <Swords className="h-3 w-3" />
          Vota ahora
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </BannerWrapper>
  )
}

function BannerConMovs({ items, total }) {
  return (
    <BannerWrapper tono="roster">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Heart className="h-3 w-3 fill-current text-gold" />
            <span className="text-[11px] font-semibold text-gold">
              Tus favoritos se movieron · últimos 7 días
            </span>
          </div>
          <ul className="mt-2 flex flex-wrap items-center gap-3">
            {items.map(({ favorito, movimiento, actividad }) => (
              <FavoritoMovido
                key={favorito.slug}
                favorito={favorito}
                movimiento={movimiento}
                actividad={actividad}
              />
            ))}
          </ul>
        </div>
        <Link
          to="/perfil"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/8 px-3 py-1.5 text-[12px] font-semibold text-gold hover:bg-gold/14"
        >
          Mi roster ({total})
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </BannerWrapper>
  )
}

function BannerConActividad({ items, total }) {
  return (
    <BannerWrapper tono="emerald">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-success" />
            <span className="text-[11px] font-semibold text-success">
              Tus favoritos están activos · últimos 7 días
            </span>
          </div>
          <ul className="mt-2 flex flex-wrap items-center gap-3">
            {items.map(({ favorito, actividad }) => (
              <FavoritoActivo
                key={favorito.slug}
                favorito={favorito}
                actividad={actividad}
              />
            ))}
          </ul>
        </div>
        <Link
          to="/perfil"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-success/40 bg-success/5 px-3 py-1.5 text-[12px] font-semibold text-success hover:bg-success/15"
        >
          Mi roster ({total})
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </BannerWrapper>
  )
}

function FavoritoMovido({ favorito, movimiento, actividad }) {
  const subio = movimiento.delta > 0
  const Icon = subio ? TrendingUp : TrendingDown
  const colorClase = subio ? 'text-success' : 'text-danger'
  const votos = actividad?.votosPeriodoActual ?? 0
  return (
    <li>
      <Link
        to={`/personajes/${favorito.slug}`}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg/40 px-2 py-1 text-[12px] transition-colors hover:border-gold/60"
        title={`${favorito.nombre} ${subio ? 'subió' : 'bajó'} ${Math.abs(movimiento.delta)} posiciones · ${votos} votos esta semana`}
      >
        <PersonajeImg
          slug={favorito.slug}
          src={favorito.imagenUrl}
          alt={favorito.nombre}
          loading="lazy"
          sizes="24px"
          className="h-6 w-6 rounded-full object-cover object-top"
        />
        <span className="line-clamp-1 font-semibold text-fg-strong">
          {favorito.nombre}
        </span>
        <span className={`inline-flex items-center gap-0.5 font-mono text-[11px] font-extrabold ${colorClase}`}>
          <Icon className="h-3 w-3" />
          {Math.abs(movimiento.delta)}
        </span>
        {votos > 0 && (
          <span className="font-mono text-[10px] text-fg-muted tabular-nums">
            · +{votos} votos
          </span>
        )}
      </Link>
    </li>
  )
}

function FavoritoActivo({ favorito, actividad }) {
  const votos = actividad?.votosPeriodoActual ?? 0
  return (
    <li>
      <Link
        to={`/personajes/${favorito.slug}`}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg/40 px-2 py-1 text-[12px] transition-colors hover:border-success/60"
        title={`${favorito.nombre}: ${votos} votos esta semana · sin cambio de puesto`}
      >
        <PersonajeImg
          slug={favorito.slug}
          src={favorito.imagenUrl}
          alt={favorito.nombre}
          loading="lazy"
          sizes="24px"
          className="h-6 w-6 rounded-full object-cover object-top"
        />
        <span className="line-clamp-1 font-semibold text-fg-strong">
          {favorito.nombre}
        </span>
        <span className="inline-flex items-center gap-0.5 font-mono text-[11px] font-extrabold text-success">
          +{votos}
        </span>
      </Link>
    </li>
  )
}

function BannerSkeleton() {
  return (
    <BannerWrapper tono="surface">
      <div className="flex animate-pulse items-center gap-3" aria-hidden="true">
        <div className="h-9 w-9 rounded-lg bg-surface-alt" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-1/3 rounded-lg bg-surface-alt" />
          <div className="h-2.5 w-1/2 rounded-lg bg-surface-alt" />
        </div>
      </div>
    </BannerWrapper>
  )
}

export default FavoritosPulsoBanner
