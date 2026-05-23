import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Crown,
  Sparkles,
  Swords,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import {
  ESTADO_EVENTO,
  formatRestante,
  getEstadoEvento,
  getEventoPorSlug,
  getMsRestantes,
  getPersonajesEvento,
} from '../data/eventos'
import { getStatsPersonaje } from '../lib/personajes-core'
import PersonajeCutImg from '../components/PersonajeCutImg'
import PersonajeImg from '../components/PersonajeImg'
import EditorialCover from '../components/EditorialCover'
import { BRAND_VISUALS, getEventVisual } from '../data/visual-assets'
import { VisualPageShell } from '../components/VisualSystem'
import NotFoundPage from './NotFoundPage'

/**
 * Página detalle de un evento temporal.
 *
 * <p>Estructura:
 * <ul>
 *   <li>Header con emoji + título + countdown + estado.</li>
 *   <li>Ranking del evento — personajes participantes ordenados por ELO
 *       local. Es la "competencia" del evento sin tocar el ranking
 *       global ELO base.</li>
 *   <li>CTAs: votar duelos abiertos (lleva a /votar; v1 no filtra al
 *       backend por evento, eso queda para futura iteración).</li>
 * </ul>
 *
 * <p>El countdown se refresca cada 60s para que "termina en 3h" baje a
 * "2h" sin reload. SEO: noindex en eventos pasados, normal en activos
 * y próximos para que Google los descubra durante su ventana.
 */
function EventoDetailPage() {
  const { slug } = useParams()
  const evento = useMemo(() => getEventoPorSlug(slug), [slug])

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // SIEMPRE llamar hooks antes del early return — Rules of Hooks.
  useSeo(
    evento
      ? {
          title: `${evento.titulo} · Evento AnimeShowdown`,
          description: evento.descripcionCorta,
          noindex: evento ? getEstadoEvento(evento, now) === ESTADO_EVENTO.PASADO : true,
        }
      : { title: 'Evento no encontrado', noindex: true },
  )

  if (!evento) return <NotFoundPage />

  const estado = getEstadoEvento(evento, now)
  const msRestantes = getMsRestantes(evento, now)
  const restante = formatRestante(msRestantes)

  const participantes = getPersonajesEvento(evento)
    .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
    .sort((a, b) => b.elo - a.elo)

  const tonosBg = {
    rose: 'border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent',
    violet: 'border-violet-500/30 bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-transparent',
    amber: 'border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent',
    pink: 'border-pink-500/30 bg-gradient-to-br from-pink-500/15 via-pink-500/5 to-transparent',
    cyan: 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/15 via-cyan-500/5 to-transparent',
  }
  const tonosTexto = {
    rose: 'text-rose-200',
    violet: 'text-violet-200',
    amber: 'text-amber-200',
    pink: 'text-pink-200',
    cyan: 'text-cyan-200',
  }
  const tonoBg = tonosBg[evento.color] ?? tonosBg.amber
  const tonoTexto = tonosTexto[evento.color] ?? tonosTexto.amber
  const visual = getEventVisual(evento.slug, evento.titulo)

  const estadoLabel =
    estado === ESTADO_EVENTO.ACTIVO
      ? `En curso · termina en ${restante}`
      : estado === ESTADO_EVENTO.PROXIMO
        ? `Empieza en ${restante}`
        : 'Finalizado'

  // Sprint UX (2026-05-18): mini-stats agregadas + "Misión del evento"
  // — la página antes era header + grid plano. Falta sentido competitivo.
  // Calculamos en cliente desde el catálogo (sin tocar backend) para
  // dar contexto rápido: cuántos top 100 globales hay, cuántos top 25,
  // ELO máximo. Lo bastante para hacer del evento "una temporada con
  // tier list" en vez de "una lista de personajes".
  const top100 = participantes.filter((p) => p.elo >= 1750).length
  const top25 = participantes.filter((p) => p.elo >= 1950).length
  const eloMax = participantes[0]?.elo ?? 0
  const misionPorEstado = {
    [ESTADO_EVENTO.ACTIVO]:
      'Vota duelos entre estos personajes para mover su ELO durante la ventana del evento. El podio final se cierra cuando termine el countdown.',
    [ESTADO_EVENTO.PROXIMO]:
      'Aún no está abierto. Elige tus favoritos del roster y vuelve cuando empiece el countdown — el ranking del evento se calculará desde el momento del start.',
    [ESTADO_EVENTO.PASADO]:
      'Evento cerrado. El podio que ves es el resultado final acumulado durante su ventana activa.',
  }
  const misionEvento = misionPorEstado[estado]

  return (
    <VisualPageShell visual={visual} contentClassName="mx-auto max-w-5xl" density="low" lateralKanji={{left: visual?.kanji ?? "祭", right: "祭"}}>
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Eventos', path: '/eventos' },
          { label: evento.titulo, path: `/eventos/${evento.slug}` },
        ])}
      />
        <Link
          to="/eventos"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Ver todos los eventos
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`relative mb-10 flex min-h-80 flex-col justify-end gap-4 overflow-hidden rounded-2xl border p-6 sm:p-8 ${tonoBg}`}
        >
          <EditorialCover
            visual={visual}
            className="absolute inset-0 rounded-none border-0 opacity-90"
            imageClassName="saturate-110 contrast-105"
          />
          <span className={`relative inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${tonoTexto}`}>
            <CalendarClock className="h-3 w-3" />
            {estadoLabel}
          </span>
          <div className="relative flex items-center gap-3">
            <span aria-hidden="true" className="text-3xl sm:text-4xl">
              {evento.emoji}
            </span>
            <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-tight tracking-tight">
              {evento.titulo}
            </h1>
          </div>
          <p className="relative max-w-2xl text-fg-muted">{evento.descripcionCorta}</p>
          {estado === ESTADO_EVENTO.ACTIVO && (
            <div className="relative flex flex-wrap items-center gap-2 pt-2">
              <Link
                to="/votar"
                className="group inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
              >
                <Swords className="h-4 w-4" />
                Vota duelos abiertos
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/ranking"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
              >
                Ver ranking global
              </Link>
            </div>
          )}
        </motion.header>

        {/* Sprint UX (2026-05-18): bloque de "Misión del evento" + stats
            agregadas para que la página se sienta como una temporada
            con métricas propias, no un grid plano. */}
        {participantes.length > 0 && (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr] sm:gap-4">
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:p-5">
              <span className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-gold">
                <Sparkles className="h-3 w-3" />
                Misión del evento
              </span>
              <p className="text-[13px] leading-relaxed text-fg-muted sm:text-[14px]">
                {misionEvento}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface p-3 sm:p-4">
              <MiniStat label="Participantes" value={participantes.length} />
              <MiniStat label="Top 100" value={top100} tone="amber" />
              <MiniStat label="ELO máx" value={eloMax || '—'} mono />
            </div>
          </div>
        )}

        <div className="mb-4 flex items-end justify-between gap-3 border-b border-border pb-3">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              <Sparkles className="h-3 w-3 text-gold" />
              Ranking del evento
            </span>
            <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
              {participantes.length === 0
                ? 'Participantes'
                : top25 > 0
                  ? `Podio interno · ${top25} entre top 25 global`
                  : 'Participantes ordenados por ELO'}
            </h2>
          </div>
          <span className="font-mono text-[12px] text-fg-muted tabular-nums">
            {participantes.length}
          </span>
        </div>

        {participantes.length === 0 ? (
          <EmptyEvento />
        ) : (
          <>
            <PodioEvento participantes={participantes.slice(0, 3)} tono={evento.color} />
            <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {participantes.map((p, i) => (
                <ParticipanteCard
                  key={p.slug}
                  rank={i + 1}
                  personaje={p}
                  tono={evento.color}
                />
              ))}
            </ol>
          </>
        )}
    </VisualPageShell>
  )
}

function PodioEvento({ participantes, tono }) {
  if (participantes.length === 0) return null
  const [primero, segundo, tercero] = participantes
  const ring = {
    rose: 'border-rose-500/35 from-rose-500/20',
    violet: 'border-violet-500/35 from-violet-500/20',
    amber: 'border-amber-500/35 from-amber-500/20',
    pink: 'border-pink-500/35 from-pink-500/20',
    cyan: 'border-cyan-500/35 from-cyan-500/20',
  }[tono] ?? 'border-amber-500/35 from-amber-500/20'

  return (
    <section className={`grid gap-3 rounded-2xl border bg-gradient-to-br via-surface to-bg p-4 sm:grid-cols-[1.25fr_0.85fr] sm:p-5 ${ring}`}>
      <Link
        to={`/personajes/${primero.slug}`}
        className="group relative grid overflow-hidden rounded-xl border border-amber-300/35 bg-bg/55 p-4 sm:grid-cols-[minmax(150px,220px)_1fr] sm:items-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgb(255_199_44_/_0.24),transparent_40%)]" />
        <PersonajeCutImg
          slug={primero.slug}
          alt={primero.nombre}
          className="relative h-64 w-full rounded-xl border border-amber-300/25 sm:h-72"
          imgClassName="p-2 transition-transform duration-300 group-hover:scale-105"
          loading="eager"
        />
        <div className="relative mt-4 min-w-0 sm:mt-0 sm:pl-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-200">
            <Crown className="h-3.5 w-3.5" />
            #1 del evento
          </span>
          <h3 className="mt-3 text-3xl font-black leading-tight text-fg-strong">
            {primero.nombre}
          </h3>
          <p className="mt-1 text-sm text-fg-muted">{primero.anime}</p>
          <p className="mt-4 font-mono text-sm font-bold text-gold">
            ELO {primero.elo}
          </p>
        </div>
      </Link>
      <div className="grid gap-3">
        {[segundo, tercero].filter(Boolean).map((p, idx) => (
          <Link
            key={p.slug}
            to={`/personajes/${p.slug}`}
            className="group grid grid-cols-[96px_1fr] items-center gap-3 rounded-xl border border-border bg-bg/45 p-3 transition-colors hover:border-accent/45"
          >
            <PersonajeCutImg
              slug={p.slug}
              alt={p.nombre}
              className="h-28 w-24 rounded-lg border border-accent/15"
              imgClassName="p-1 transition-transform duration-300 group-hover:scale-105"
            />
            <div className="min-w-0">
              <span className="font-mono text-[11px] font-black uppercase tracking-[0.12em] text-fg-muted">
                #{idx + 2}
              </span>
              <p className="mt-1 line-clamp-1 text-sm font-bold text-fg-strong">
                {p.nombre}
              </p>
              <p className="line-clamp-1 text-[12px] text-fg-muted">{p.anime}</p>
              <p className="mt-2 font-mono text-[12px] font-bold text-gold">
                ELO {p.elo}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function ParticipanteCard({ rank, personaje, tono }) {
  const TONO_RANK = {
    rose: 'bg-rose-500/20 text-rose-200',
    violet: 'bg-violet-500/20 text-violet-200',
    amber: 'bg-amber-500/20 text-amber-200',
    pink: 'bg-pink-500/20 text-pink-200',
    cyan: 'bg-cyan-500/20 text-cyan-200',
  }
  const tonoRank = TONO_RANK[tono] ?? TONO_RANK.amber
  return (
    <li>
      <Link
        to={`/personajes/${personaje.slug}`}
        className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 transition-all hover:-translate-y-0.5 hover:border-accent/40 sm:p-3"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-bg">
          <PersonajeImg
            slug={personaje.slug}
            alt={personaje.nombre}
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
          <span
            className={`absolute left-1.5 top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 font-mono text-[10px] font-extrabold ${tonoRank}`}
          >
            {rank === 1 ? <Crown className="h-3 w-3" /> : `#${rank}`}
          </span>
        </div>
        <div className="min-w-0">
          <p className="line-clamp-1 text-[12px] font-bold text-fg-strong group-hover:text-gold sm:text-[13px]">
            {personaje.nombre}
          </p>
          <p className="line-clamp-1 text-[10px] text-fg-muted sm:text-[11px]">
            {personaje.anime}
          </p>
        </div>
        <p className="font-mono text-[11px] font-bold text-gold">
          ELO {personaje.elo}
        </p>
      </Link>
    </li>
  )
}

function MiniStat({ label, value, tone, mono }) {
  const toneClass =
    tone === 'amber' ? 'text-amber-300' : 'text-fg-strong'
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-fg-muted sm:text-[10px]">
        {label}
      </p>
      <p
        className={`${mono ? 'font-mono tabular-nums' : ''} text-base font-extrabold ${toneClass} sm:text-lg`}
      >
        {value}
      </p>
    </div>
  )
}

function EmptyEvento() {
  return (
    <div className="relative flex min-h-72 flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-dashed border-border bg-surface/40 p-8 text-center">
      <EditorialCover
        visual={BRAND_VISUALS.empty}
        className="absolute inset-0 rounded-none border-0 opacity-60"
        imageClassName="saturate-110 contrast-105"
      />
      <p className="relative text-[14px] font-semibold text-fg-strong">
        Sin participantes
      </p>
      <p className="relative max-w-xs text-[12px] text-fg-muted">
        El filtro del evento no encontró personajes en el catálogo. Si
        crees que falta alguien, su slug puede no estar tagueado todavía
        en personajes-tags.js.
      </p>
    </div>
  )
}

export default EventoDetailPage
