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
import { getStatsPersonaje, imagenPersonaje } from '../data/personajes'
import NotFoundPage from './NotFoundPage'

/**
 * Página detalle de un evento temporal (Plan producto 2026-05-18).
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

  const estadoLabel =
    estado === ESTADO_EVENTO.ACTIVO
      ? `En curso · termina en ${restante}`
      : estado === ESTADO_EVENTO.PROXIMO
        ? `Empieza en ${restante}`
        : 'Finalizado'

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Eventos', path: '/eventos' },
          { label: evento.titulo, path: `/eventos/${evento.slug}` },
        ])}
      />
      <div className="mx-auto max-w-5xl">
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
          className={`mb-10 flex flex-col gap-4 rounded-2xl border p-6 sm:p-8 ${tonoBg}`}
        >
          <span className={`inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${tonoTexto}`}>
            <CalendarClock className="h-3 w-3" />
            {estadoLabel}
          </span>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-3xl sm:text-4xl">
              {evento.emoji}
            </span>
            <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-tight tracking-tight">
              {evento.titulo}
            </h1>
          </div>
          <p className="max-w-2xl text-fg-muted">{evento.descripcionCorta}</p>
          {estado === ESTADO_EVENTO.ACTIVO && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
              >
                Ver ranking global
              </Link>
            </div>
          )}
        </motion.header>

        <div className="mb-4 flex items-end justify-between gap-3 border-b border-border pb-3">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              <Sparkles className="h-3 w-3 text-accent" />
              Ranking del evento
            </span>
            <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
              Participantes ordenados por ELO
            </h2>
          </div>
          <span className="font-mono text-[12px] text-fg-muted tabular-nums">
            {participantes.length}
          </span>
        </div>

        {participantes.length === 0 ? (
          <EmptyEvento />
        ) : (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {participantes.map((p, i) => (
              <ParticipanteCard
                key={p.slug}
                rank={i + 1}
                personaje={p}
                tono={evento.color}
              />
            ))}
          </ol>
        )}
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
          <img
            src={imagenPersonaje(personaje.slug)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
          <span
            className={`absolute left-1.5 top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 font-mono text-[10px] font-extrabold ${tonoRank}`}
          >
            {rank === 1 ? <Crown className="h-3 w-3" /> : `#${rank}`}
          </span>
        </div>
        <div className="min-w-0">
          <p className="line-clamp-1 text-[12px] font-bold text-fg-strong group-hover:text-accent sm:text-[13px]">
            {personaje.nombre}
          </p>
          <p className="line-clamp-1 text-[10px] text-fg-muted sm:text-[11px]">
            {personaje.anime}
          </p>
        </div>
        <p className="font-mono text-[11px] font-bold text-accent">
          ELO {personaje.elo}
        </p>
      </Link>
    </li>
  )
}

function EmptyEvento() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface/40 p-8 text-center">
      <p className="text-[14px] font-semibold text-fg-strong">
        Sin participantes
      </p>
      <p className="max-w-xs text-[12px] text-fg-muted">
        El filtro del evento no encontró personajes en el catálogo. Si
        crees que falta alguien, su slug puede no estar tagueado todavía
        en personajes-tags.js.
      </p>
    </div>
  )
}

export default EventoDetailPage
