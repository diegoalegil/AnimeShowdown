import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
import EditorialCover from '../components/EditorialCover'
import { CinematicHero, EmptyStateScene, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS, getEventVisual } from '../data/visual-assets'

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
    <VisualPageShell visual={BRAND_VISUALS.eventos}>
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Eventos', path: '/eventos' },
        ])}
      />
      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.eventos}
          icon={CalendarClock}
          eyebrow="Temporadas · Copas · Semanas"
          title="Eventos de AnimeShowdown"
          subtitle="Semanas temáticas, copas de villanos y arcos de héroes con portada de campaña propia. El ranking ELO global no se toca: los eventos son competiciones paralelas."
        />

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
    </VisualPageShell>
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
  const visual = getEventVisual(evento.slug, evento.titulo)

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
      className={`as-panel group flex flex-col overflow-hidden rounded-xl border p-0 transition-all hover:-translate-y-1 ${tono}`}
    >
      <EditorialCover
        visual={visual}
        title={evento.titulo}
        eyebrow={etiqueta}
        meta={`${participantes.length} personajes · ${evento.descripcionCorta}`}
        className="h-48 rounded-none border-0"
        compact
      />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl shadow-lg" aria-hidden="true">
            {evento.emoji}
          </span>
          <h3 className="text-xl font-extrabold text-fg-strong group-hover:text-accent sm:text-2xl">
            {evento.titulo}
          </h3>
        </div>
        <p className="line-clamp-2 text-[13px] text-fg-muted">
          {evento.descripcionCorta}
        </p>
        <div className="mt-auto flex items-center justify-between text-[12px] text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {restanteLabel}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-accent transition-transform group-hover:translate-x-0.5">
            Ver
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

function EmptyTodos() {
  return (
    <EmptyStateScene
      visual={BRAND_VISUALS.empty}
      icon={CalendarClock}
      title="Sin eventos en el calendario"
      action={{ to: '/votar', label: 'Votar mientras tanto' }}
    >
      <p>
        Cuando preparamos una nueva temporada (Semana X, Copa Y…), aparece
        aquí con su contador. Vuelve pronto.
      </p>
    </EmptyStateScene>
  )
}

export default EventosIndexPage
