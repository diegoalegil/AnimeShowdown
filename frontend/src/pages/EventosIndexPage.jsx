import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import {
  getEventosActivos,
  getEventosPasados,
  getEventosProximos,
} from '../data/eventos'
import { useEventos } from '../hooks/useEventos'
import EmptyState from '../components/EmptyState'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS, getEventVisual } from '../data/visual-assets'
import FestivalBoard from '../features/eventos/FestivalBoard'

/**
 * Índice de eventos temporales: la cartelera de festivales
 * (FestivalBoard) — rail temporal con nudos por mes, un cartel por
 * evento con su linterna chōchin. Los estados (futuro/activo/pasado)
 * los deriva el board en vivo con su ticker coalescado; la página solo
 * agrupa UNA vez para capar el historial a 6.
 */
function EventosIndexPage() {
  useSeo({
    title: 'Eventos',
    description:
      'Semanas y copas temporales de AnimeShowdown: arcos de villanos, top waifus, semanas de animes. Vota durante cada temporada y mira quién gana.',
    image: BRAND_VISUALS.eventos.image,
  })
  // Now de agrupación: una sola lectura al montar (el corte en vivo
  // activo→pasado lo gestiona el propio board sin recargar).
  const [ahora] = useState(() => new Date())
  const eventos = useEventos()
  const lista = useMemo(() => {
    const visibles = [
      ...getEventosProximos(ahora, eventos),
      ...getEventosActivos(ahora, eventos),
      ...getEventosPasados(ahora, eventos).slice(0, 6),
    ]
    return visibles
      .map((evento) => {
        const visual = getEventVisual(evento.slug, evento.titulo)
        return {
          slug: evento.slug,
          titulo: evento.titulo,
          descripcionCorta: evento.descripcionCorta,
          inicio: new Date(evento.inicioISO),
          fin: new Date(evento.finISO),
          arteSrc: visual?.image ?? null,
          arteSrcSet: visual?.imageWebpSrcset ?? undefined,
          kanji: visual?.kanji ?? null,
          // recompensas/canjeDisponible: el dato no existe aún en
          // data/eventos — el cartel degrada limpio sin chips ni cordón.
        }
      })
      // Orden del board: futuro → activo → pasado (el concat de los
      // getters ya agrupa; el re-sort global por fecha rompia los grupos
      // cuando un activo empezo antes que el fin de un pasado reciente).
  }, [ahora, eventos])

  const total = lista.length

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

        {total > 0 && (
          <FestivalBoard
            eventos={lista}
            hrefDe={(slug) => `/eventos/${slug}`}
          />
        )}
      </div>
    </VisualPageShell>
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
