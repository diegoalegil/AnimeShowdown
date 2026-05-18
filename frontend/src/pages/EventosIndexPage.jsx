import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import {
  formatRestante,
  getEventosActivos,
  getEventosPasados,
  getEventosProximos,
  getMsRestantes,
  getPersonajesEvento,
} from '../data/eventos'
import { imagenPersonaje } from '../data/personajes'

/**
 * Índice de eventos temporales (Plan producto 2026-05-18). Tres
 * secciones: activos, próximos, pasados — solo aparecen las que
 * tienen items. Cada card linka a /eventos/:slug.
 */
function EventosIndexPage() {
  useSeo({
    title: 'Eventos · AnimeShowdown',
    description:
      'Semanas y copas temporales de AnimeShowdown: arcos de villanos, top waifus, semanas de animes. Vota durante cada temporada y mira quién gana.',
  })
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const activos = getEventosActivos(now)
  const proximos = getEventosProximos(now)
  const pasados = getEventosPasados(now).slice(0, 6)

  const total = activos.length + proximos.length + pasados.length

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Eventos', path: '/eventos' },
        ])}
      />
      <div className="mx-auto max-w-5xl">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
            <CalendarClock className="h-3 w-3" />
            Temporadas · Copas · Semanas
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Eventos de AnimeShowdown
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Semanas temáticas, copas de villanos, arcos de héroes. Cada
            evento agrupa personajes por criterio y los enfrenta durante
            unos días. El ranking ELO global no se toca — los eventos
            son competiciones paralelas.
          </p>
        </motion.header>

        {total === 0 && <EmptyTodos />}

        {activos.length > 0 && (
          <Seccion
            icon={Sparkles}
            tono="text-emerald-300"
            dotColor="bg-emerald-400"
            titulo="En curso"
            count={activos.length}
            eventos={activos}
            now={now}
            etiqueta="ACTIVO"
          />
        )}
        {proximos.length > 0 && (
          <Seccion
            icon={Clock}
            tono="text-cyan-300"
            dotColor="bg-cyan-400"
            titulo="Próximamente"
            count={proximos.length}
            eventos={proximos}
            now={now}
            etiqueta="PROXIMO"
            className="mt-12"
          />
        )}
        {pasados.length > 0 && (
          <Seccion
            icon={CheckCircle2}
            tono="text-fg-muted"
            dotColor="bg-fg-muted"
            titulo="Pasados"
            count={pasados.length}
            eventos={pasados}
            now={now}
            etiqueta="PASADO"
            className="mt-12"
          />
        )}
      </div>
    </section>
  )
}

function Seccion({ icon: Icon, tono, dotColor, titulo, count, eventos, now, etiqueta, className = '' }) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-surface ${tono}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h2 className={`text-[13px] font-semibold uppercase tracking-[0.1em] ${tono}`}>
          {titulo}
        </h2>
        <span className="font-mono text-[11px] text-fg-muted tabular-nums">
          ({count})
        </span>
        <span className={`ml-auto h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {eventos.map((e) => (
          <EventoCard key={e.slug} evento={e} now={now} etiqueta={etiqueta} />
        ))}
      </div>
    </div>
  )
}

function EventoCard({ evento, now, etiqueta }) {
  const ms = getMsRestantes(evento, now)
  const restante = formatRestante(ms)
  const participantes = getPersonajesEvento(evento)
  const preview = participantes.slice(0, 4)

  const TONOS = {
    rose: 'border-rose-500/30 hover:border-rose-500/60',
    violet: 'border-violet-500/30 hover:border-violet-500/60',
    amber: 'border-amber-500/30 hover:border-amber-500/60',
    pink: 'border-pink-500/30 hover:border-pink-500/60',
    cyan: 'border-cyan-500/30 hover:border-cyan-500/60',
  }
  const tono = TONOS[evento.color] ?? TONOS.amber

  const restanteLabel =
    etiqueta === 'ACTIVO'
      ? `Termina en ${restante}`
      : etiqueta === 'PROXIMO'
        ? `Empieza en ${restante}`
        : 'Finalizado'

  return (
    <Link
      to={`/eventos/${evento.slug}`}
      className={`group flex flex-col gap-3 rounded-xl border bg-surface p-4 transition-all hover:-translate-y-1 sm:p-5 ${tono}`}
    >
      <div className="flex -space-x-2">
        {preview.map((p) => (
          <img
            key={p.slug}
            src={imagenPersonaje(p.slug)}
            alt=""
            loading="lazy"
            className="h-10 w-10 rounded-full border-2 border-surface object-cover object-top"
          />
        ))}
        {participantes.length > preview.length && (
          <span className="z-10 inline-flex h-10 min-w-[40px] items-center justify-center rounded-full border-2 border-surface bg-bg px-2 text-[11px] font-bold text-fg-muted">
            +{participantes.length - preview.length}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xl">
          {evento.emoji}
        </span>
        <h3 className="text-base font-bold text-fg-strong group-hover:text-accent sm:text-lg">
          {evento.titulo}
        </h3>
      </div>
      <p className="line-clamp-2 text-[12px] text-fg-muted">
        {evento.descripcionCorta}
      </p>
      <div className="mt-auto flex items-center justify-between text-[11px] text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {restanteLabel}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-accent group-hover:translate-x-0.5">
          Ver
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  )
}

function EmptyTodos() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-surface/40 p-12 text-center">
      <CalendarClock className="h-10 w-10 text-fg-muted" />
      <p className="text-lg font-bold text-fg-strong">
        Sin eventos en el calendario
      </p>
      <p className="max-w-md text-[13px] text-fg-muted">
        Cuando preparamos una nueva temporada (Semana X, Copa Y…), aparece
        aquí con su contador. Vuelve pronto.
      </p>
    </div>
  )
}

export default EventosIndexPage
