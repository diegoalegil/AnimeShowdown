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
import { useEventos } from '../hooks/useEventos'
import EditorialCover from '../components/EditorialCover'
import EmptyState from '../components/EmptyState'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS, getEventVisual } from '../data/visual-assets'

/**
 * Índice de eventos temporales. Tres
 * secciones: activos, próximos, pasados — solo aparecen las que
 * tienen items. Cada card linka a /eventos/:slug.
 */
function EventosIndexPage() {
  useSeo({
    title: 'Eventos',
    description:
      'Semanas y copas temporales de AnimeShowdown: arcos de villanos, top waifus, semanas de animes. Vota durante cada temporada y mira quién gana.',
    image: BRAND_VISUALS.eventos.image,
  })
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const eventos = useEventos()
  const activos = getEventosActivos(now, eventos)
  const proximos = getEventosProximos(now, eventos)
  const pasados = getEventosPasados(now, eventos).slice(0, 6)

  const total = activos.length + proximos.length + pasados.length

  return (
    <VisualPageShell visual={BRAND_VISUALS.eventos} lateralKanji={{left: "祭", right: "典"}}>
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Eventos', path: '/eventos' },
        ])}
      />
      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.eventos} lateralKanji={{left: "祭", right: "典"}}
          icon={CalendarClock}
          eyebrow="Temporadas · Copas · Semanas"
          title="Eventos de AnimeShowdown"
          subtitle="Semanas temáticas, copas de villanos y arcos de héroes con portada de campaña propia. El ranking ELO global no se toca: los eventos son competiciones paralelas."
        />

        {total === 0 && <EmptyTodos />}

        {activos.length > 0 && (
          <Seccion
            icon={Sparkles}
            tono="text-success"
            dotColor="bg-success"
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
            tono="text-electric"
            dotColor="bg-electric"
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
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg bg-surface ${tono}`}>
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
    rose: 'border-danger/30 hover:border-danger/60',
    violet: 'border-rarity-epic/30 hover:border-rarity-epic/60',
    amber: 'border-gold/30 hover:border-gold/60',
    pink: 'border-arc-waifu/30 hover:border-arc-waifu/60',
    cyan: 'border-electric/30 hover:border-electric/60',
  }
  const tono = TONOS[evento.color] ?? TONOS.amber

  const restanteLabel =
    etiqueta === 'ACTIVO'
      ? `Termina en ${restante}`
      : etiqueta === 'PROXIMO'
        ? `Empieza en ${restante}`
        : 'Finalizado'

  // Cover h-56 para que composiciones ricas en personajes, siluetas y fondo
  // respiren. Glow hover con accent del propio evento en lugar del genérico.
  const glowHover = {
    rose: 'hover:shadow-lift [--aura-color:rgb(244_63_94_/_0.55)]',
    violet: 'hover:shadow-lift [--aura-color:rgb(139_92_246_/_0.55)]',
    amber: 'hover:shadow-lift [--aura-color:rgb(245_158_11_/_0.55)]',
    pink: 'hover:shadow-lift [--aura-color:rgb(236_72_153_/_0.55)]',
    cyan: 'hover:shadow-lift [--aura-color:rgb(6_182_212_/_0.55)]',
  }
  const sombra = glowHover[evento.color] ?? glowHover.amber

  return (
    <Link
      to={`/eventos/${evento.slug}`}
      className={`as-panel group flex flex-col overflow-hidden rounded-2xl border p-0 transition-all duration-300 hover:-translate-y-1.5 ${tono} ${sombra}`}
    >
      <EditorialCover
        visual={visual}
        title={evento.titulo}
        eyebrow={etiqueta}
        meta={`${participantes.length} personajes · ${evento.descripcionCorta}`}
        className="h-56 rounded-none border-0"
        imageClassName="saturate-105 contrast-100"
        compact
      />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl shadow-lg" aria-hidden="true">
            {evento.emoji}
          </span>
          <h3 className="text-xl font-extrabold text-fg-strong group-hover:text-gold sm:text-2xl">
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
          <span className="inline-flex items-center gap-1 font-semibold text-gold transition-transform group-hover:translate-x-0.5">
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
    <EmptyState scene
      visual={BRAND_VISUALS.empty}
      icon={CalendarClock}
      title="Sin eventos en el calendario"
      action={{ to: '/votar', label: 'Votar mientras tanto' }}
    >
      <p>
        Cuando preparamos una nueva temporada (Semana X, Copa Y…), aparece
        aquí con su contador. Vuelve pronto.
      </p>
    </EmptyState>
  )
}

export default EventosIndexPage
