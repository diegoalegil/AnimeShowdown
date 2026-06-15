import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Crown,
  Sparkles,
  Swords,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, eventoSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import {
  ESTADO_EVENTO,
  formatRestante,
  getEstadoEvento,
  getEventoPorSlug,
  getMsRestantes,
  getPersonajesEvento,
} from '../data/eventos'
import { useEventos } from '../hooks/useEventos'
import { useReducedMotionPref } from '../hooks/useReducedMotionPref'
import { getStatsPersonaje } from '../lib/personajes-core'
import PersonajeCutImg from '../components/PersonajeCutImg'
import PersonajeImg from '../components/PersonajeImg'
import EditorialCover from '../components/EditorialCover'
import { BRAND_VISUALS, getEventVisual } from '../data/visual-assets'
import FestivalProcession from '../features/eventos/matsuri/FestivalProcession'
import EventCountdown from '../features/eventos/matsuri/EventCountdown'
import MilestonePath from '../features/eventos/matsuri/MilestonePath'
import YataiStall from '../features/eventos/matsuri/YataiStall'
import { deriveHitosEvento, KANJI_TIPO, ETIQUETA_TIPO } from '../features/eventos/matsuri/festival-core'
import NotFoundPage from './NotFoundPage'

/**
 * Página detalle de un evento temporal — takeover "Matsuri nocturno".
 *
 * <p>La pieza FestivalProcession ENMARCA el contenido REAL como una calle de
 * festival nocturna (cielo + luna con 祭 + faroles en parallax). El contenido del
 * dominio se conserva intacto dentro de puestos (YataiStall):
 * <ul>
 *   <li>Cabecera: kicker de estado + emoji + h1 (único) = título + descripción +
 *       countdown REAL (EventCountdown sobre inicioISO/finISO).</li>
 *   <li>Senda de hitos (MilestonePath) = fases de fecha derivadas de la línea
 *       temporal real (deriveHitosEvento): Apertura / Ecuador / Recta final /
 *       Cierre. Piedras encendidas para fases pasadas, sin ceremonia.</li>
 *   <li>Misión + mini-stats (Participantes / Top 100 / ELO máx).</li>
 *   <li>Ranking: PodioEvento (#1/#2/#3) + grid de ParticipanteCard por ELO.</li>
 * </ul>
 *
 * <p>Estados reales (getEstadoEvento): ACTIVO (calle viva + hanabi de entrada),
 * PROXIMO (penumbra, countdown protagonista, puestos con persiana), PASADO
 * (faroles apagándose + despedida; el podio es el resultado final).
 *
 * <p>El `now` se refresca cada 60s para que el estado/hitos pasen de "próximo" a
 * "activo" sin reload (el countdown vivo lo lleva EventCountdown por su cuenta).
 * SEO: noindex en eventos pasados, normal en activos/próximos.
 */
function EventoDetailPage() {
  const { slug } = useParams()
  const eventos = useEventos()
  const reduce = useReducedMotionPref()
  const evento = useMemo(() => getEventoPorSlug(slug, eventos), [slug, eventos])

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
  const restante = formatRestante(getMsRestantes(evento, now))
  // Hitos de fecha-fase derivados de la línea temporal REAL (cero fabricación).
  const hitos = deriveHitosEvento(evento, now)
  const proximo = estado === ESTADO_EVENTO.PROXIMO
  const pasado = estado === ESTADO_EVENTO.PASADO

  const participantes = getPersonajesEvento(evento)
    .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
    .sort((a, b) => b.elo - a.elo)

  const visual = getEventVisual(evento.slug, evento.titulo)

  const estadoLabel =
    estado === ESTADO_EVENTO.ACTIVO
      ? `En curso · termina en ${restante}`
      : estado === ESTADO_EVENTO.PROXIMO
        ? `Empieza en ${restante}`
        : 'Finalizado'

  // mini-stats agregadas + "Misión del evento" — la página se siente como una
  // temporada con métricas propias. Cálculo en cliente desde el catálogo (sin
  // backend): top 100 globales, top 25, ELO máximo.
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

  const rankingTitulo =
    participantes.length === 0
      ? 'Participantes'
      : top25 > 0
        ? `Podio interno · ${top25} entre top 25 global`
        : 'Participantes ordenados por ELO'

  // Cabecera del matsuri: kicker de estado + emoji + h1 (único) + descripción +
  // countdown real. En PROXIMO el countdown es protagonista (hero).
  const header = (
    <>
      <Link
        to="/eventos"
        className="fest-back-link inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
      >
        <ArrowLeft className="h-4 w-4" />
        Ver todos los eventos
      </Link>
      <span className="fest-head__kicker">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        {estadoLabel}
      </span>
      <h1 className="fest-head__title">
        <span aria-hidden="true" className="fest-head__emoji">{evento.emoji}</span>{' '}
        {evento.titulo}
      </h1>
      <p className="fest-head__desc">{evento.descripcionCorta}</p>
      {/* Sin odómetro en eventos PASADOS: un timer a 00:00:00 bajo "Finalizado"
          parece roto. El kicker de estado ya comunica el cierre. */}
      {!pasado && <EventCountdown evento={evento} hero={proximo} />}
      {estado === ESTADO_EVENTO.ACTIVO && (
        <div className="fest-head__ctas">
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
    </>
  )

  const farewell = (
    <section className="fest-farewell" aria-label="Cierre del festival">
      <span className="fest-head__kicker" style={{ justifyContent: 'center' }}>
        <span aria-hidden="true">{'灯 '}</span>El matsuri ha cerrado sus puertas
      </span>
      <p className="fest-farewell__copy">
        Los faroles se apagan y la calle se recoge. El podio que ves quedó sellado
        como resultado final de la ventana del evento.
      </p>
    </section>
  )

  return (
    <FestivalProcession
      estado={estado}
      header={header}
      milestones={hitos.length > 0 ? <MilestonePath hitos={hitos} /> : null}
      farewell={farewell}
    >
      <JsonLd
        id="evento"
        schema={eventoSchema(evento, participantes, {
          estado,
          image: visual?.image,
        })}
      />
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Eventos', path: '/eventos' },
          { label: evento.titulo, path: `/eventos/${evento.slug}` },
        ])}
      />

      {/* Puesto: Misión + mini-stats (aviso 御). Datos reales intactos. */}
      {participantes.length > 0 && (
        <YataiStall
          tipo="texto"
          titulo="Misión del evento"
          kanji={KANJI_TIPO.texto}
          etiqueta={ETIQUETA_TIPO.texto}
          toldo="carmin"
          ariaLabel="Misión del evento"
          cerrado={proximo}
          reduce={reduce}
        >
          <div className="fest-stall-grid">
            <div className="flex flex-col gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold text-gold">
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
        </YataiStall>
      )}

      {/* Puesto: Ranking del evento (recompensa 王). Podio + roster intactos. */}
      <YataiStall
        tipo="recompensa"
        titulo="Ranking del evento"
        kanji={KANJI_TIPO.recompensa}
        etiqueta={ETIQUETA_TIPO.recompensa}
        toldo="oro"
        ariaLabel="Ranking del evento"
        cerrado={proximo && participantes.length > 0}
        reduce={reduce}
      >
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-border pb-3">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted">
              <Sparkles className="h-3 w-3 text-gold" />
              Ranking del evento
            </span>
            <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
              {rankingTitulo}
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
      </YataiStall>

      {!pasado && (
        <p className="fest-back-foot">
          <Link
            to="/eventos"
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
          >
            <ArrowLeft className="h-4 w-4" />
            Ver todos los eventos
          </Link>
        </p>
      )}
    </FestivalProcession>
  )
}

function PodioEvento({ participantes, tono }) {
  if (participantes.length === 0) return null
  const [primero, segundo, tercero] = participantes
  const ring = {
    rose: 'border-danger/35 from-danger/20',
    violet: 'border-rarity-epic/35 from-rarity-epic/20',
    amber: 'border-gold/35 from-gold/20',
    pink: 'border-arc-waifu/35 from-arc-waifu/20',
    cyan: 'border-electric/35 from-electric/20',
  }[tono] ?? 'border-gold/35 from-gold/20'

  return (
    <section className={`grid gap-3 rounded-2xl border bg-gradient-to-br via-surface to-bg p-4 sm:grid-cols-[1.25fr_0.85fr] sm:p-5 ${ring}`}>
      <Link
        to={`/personajes/${primero.slug}`}
        className="group relative grid overflow-hidden rounded-2xl border border-gold/35 bg-bg/55 p-4 sm:grid-cols-[minmax(150px,220px)_1fr] sm:items-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgb(255_199_44_/_0.24),transparent_40%)]" />
        <PersonajeCutImg
          slug={primero.slug}
          alt={primero.nombre}
          className="relative h-64 w-full rounded-xl border border-gold/25 sm:h-72"
          imgClassName="p-2 transition-transform duration-300 group-hover:scale-105"
          loading="eager"
        />
        <div className="relative mt-4 min-w-0 sm:mt-0 sm:pl-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-black text-gold">
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
              <span className="font-mono text-[11px] font-black text-fg-muted">
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
    rose: 'bg-danger/20 text-danger',
    violet: 'bg-rarity-epic/20 text-rarity-epic',
    amber: 'bg-gold/20 text-gold',
    pink: 'bg-arc-waifu/20 text-arc-waifu',
    cyan: 'bg-electric/20 text-electric',
  }
  const tonoRank = TONO_RANK[tono] ?? TONO_RANK.amber
  return (
    <li>
      <Link
        to={`/personajes/${personaje.slug}`}
        className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 transition-all hover:-translate-y-0.5 hover:border-accent/40 sm:p-3"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-bg">
          <PersonajeImg
            slug={personaje.slug}
            alt={personaje.nombre}
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
          <span
            className={`absolute left-1.5 top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-md px-1 font-mono text-[10px] font-extrabold ${tonoRank}`}
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
    tone === 'amber' ? 'text-gold' : 'text-fg-strong'
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <p className="text-[9px] font-semibold text-fg-muted sm:text-[10px]">
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
