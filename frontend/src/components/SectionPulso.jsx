import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  Crown,
  Radio,
  Sparkles,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { endpoints, ApiError } from '../lib/api'
import { useTorneos } from '../lib/torneosQueries'
import { imagenPersonaje, personajes, getStatsPersonaje } from '../lib/personajes-core'
import { personajeDelDia } from '../lib/games'
import {
  ESTADO_EVENTO,
  formatRestante,
  getEstadoEvento,
  getEventoHeadline,
  getMsRestantes,
  getPersonajesEvento,
} from '../data/eventos'
import { useVotosPeriodoBatch } from '../hooks/useVotosPeriodo'
import FavoritosPulsoBanner from './FavoritosPulsoBanner'
import PersonajeCutImg from './PersonajeCutImg'
import PersonajeImg from './PersonajeImg'
import EditorialCover from './EditorialCover'
import { ocultaImgRota } from '../lib/imgFallback'
import {
  BRAND_VISUALS,
  getEventVisual,
  getGameVisual,
  getTournamentVisual,
} from '../data/visual-assets'
import { LateralKanjiPair, ParticleLayer } from './VisualSystem'

/**
 * Campeón fallback derivado del catálogo local. Útil cuando el ranking
 * del backend está vacío (DB nueva, dev local sin seed de votos): la
 * card "Campeón actual" sigue mostrando algo coherente — el personaje
 * con mayor ELO base del catálogo, marcado como "Top del catálogo"
 * para no mentir presentándolo como votado por la comunidad.
 */
const CAMPEON_FALLBACK = (() => {
  const top = [...personajes]
    .filter((p) => tieneImagenPromocionable({ personaje: p }))
    .map((p) => ({ ...p, elo: getStatsPersonaje(p.slug).elo }))
    .sort((a, b) => b.elo - a.elo)[0]
  return top
    ? {
        personaje: {
          slug: top.slug,
          nombre: top.nombre,
          anime: top.anime,
          imagenUrl: imagenPersonaje(top.slug),
        },
        eloLocal: top.elo,
      }
    : null
})()

function tieneImagenPromocionable(item) {
  const p = item?.personaje ?? item
  const local = p?.slug ? personajes.find((personaje) => personaje.slug === p.slug) : null
  const imagen = p?.imagenUrl ?? local?.imagen
  return Boolean(imagen && !imagen.includes('/_missing/') && !imagen.includes('placeholder'))
}

/**
 * Pulso AnimeShowdown — sección "live" en la home.
 *
 * <p>Nota de producto (2026-05-18): la home antes mostraba un duelo random
 * cliente-side y stats estáticas. No transmitía sensación de plataforma
 * en marcha. Esta sección consolida cinco señales reales arriba de la
 * página:
 *
 * <ol>
 *   <li>Campeón actual — top 1 del ranking ELO (endpoint /votos/ranking).</li>
 *   <li>Movers de la semana — top 3 movimientos en 7 días
 *       (/votos/ranking/movimientos).</li>
 *   <li>Reto del día — personaje del Shadow Guess de hoy, link al juego.</li>
 *   <li>Torneo activo — primer torneo IN_PROGRESS, fallback a SCHEDULED.</li>
 *   <li>Duelo abierto — match aleatorio de un torneo en curso.</li>
 * </ol>
 *
 * <p>Cada card se renderiza solo si tiene datos reales (skeleton si carga,
 * null si la query falla o devuelve vacío). El stale-time de 1min recarga
 * silenciosamente cuando el usuario vuelve a la home tras un rato.
 */
const PULSE_STALE = 60 * 1000

function useRanking() {
  return useQuery({
    queryKey: ['pulso', 'ranking'],
    queryFn: endpoints.ranking,
    staleTime: PULSE_STALE,
  })
}

function useMovimientos() {
  // limit 100: cubre el top de movers Y la mayoría de slugs que un usuario
  // pueda tener en su roster — esto comparte cache con
  // FavoritosPulsoBanner, que cruza favoritos vs movimientos sin hacer
  // su propia request.
  return useQuery({
    queryKey: ['pulso', 'movimientos', 7],
    queryFn: () => endpoints.rankingMovimientos({ dias: 7, limit: 100 }),
    staleTime: PULSE_STALE,
  })
}

function useDueloAbierto() {
  return useQuery({
    queryKey: ['pulso', 'duelo'],
    queryFn: async () => {
      try {
        return await endpoints.enfrentamientoAleatorio()
      } catch (err) {
        // 404 = no hay matches abiertos ahora mismo. Devuelve null para
        // que la card se oculte sin loggear el error como problema.
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }
    },
    staleTime: PULSE_STALE,
    retry: false,
  })
}

function useUltimosVotos() {
  return useQuery({
    queryKey: ['pulso', 'votos-recientes', 8],
    queryFn: () => endpoints.votosRecientes({ limit: 8 }),
    staleTime: 30 * 1000, // 30s — el feed quiere sentirse "vivo"
  })
}

function SectionPulso() {
  const { data: ranking, isLoading: rankingLoading } = useRanking()
  const { data: movimientos } = useMovimientos()
  const { data: torneos = [] } = useTorneos()
  const { data: duelo } = useDueloAbierto()
  const { data: ultimosVotos } = useUltimosVotos()

  // Campeón real si el backend tiene votos; si no, fallback al top del
  // catálogo. Distinguimos visualmente con flag esFallback.
  const campeonReal = Array.isArray(ranking)
    ? ranking.find(tieneImagenPromocionable)
    : null
  const campeon = campeonReal ?? CAMPEON_FALLBACK
  const esFallback = !campeonReal
  // Nota de producto (2026-05-18): el backend devuelve top por COUNT(votos),
  // así que en una DB joven con 1-5 votos totales presentar al top como
  // "campeón actual" es engañoso. Sumamos los votos del ranking servido
  // y aplicamos disclaimer si el total comunidad es pequeño.
  const totalVotosComunidad = Array.isArray(ranking)
    ? ranking.reduce((acc, r) => acc + Number(r.votos ?? 0), 0)
    : 0
  const comunidadArrancando = !esFallback && totalVotosComunidad < 30
  const votosCampeon = Number(campeon?.votos ?? 0)
  const mostrarCampeon =
    rankingLoading ||
    (!esFallback && votosCampeon >= 10 && campeon?.personaje && tieneImagenPromocionable(campeon))
  const topMovers = (movimientos || [])
    .filter((m) => m.delta != null && m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
  const mostrarMovers = topMovers.length > 0
  const torneoActivo =
    torneos.find((t) => t.estado === 'IN_PROGRESS') ??
    torneos.find((t) => t.estado === 'SCHEDULED')
  // Torneo en marcha (estado IN_PROGRESS) — fallback para DueloAbiertoCard
  // cuando el endpoint /enfrentamientos/aleatorio devuelve null. En vez
  // de un dead-end "sin duelos", apuntamos al bracket donde sí los hay.
  const torneoEnCurso = torneos.find((t) => t.estado === 'IN_PROGRESS')
  const retoPersonaje = personajeDelDia('guess-character')

  // Visual de "ahora mismo": kanji 今 (ima, "ahora") + 動 (do, "movimiento")
  // a los lados para reforzar la idea de actividad en vivo.
  const pulseVisual = BRAND_VISUALS.pulse
  const pulseImage = pulseVisual.image || pulseVisual.fallbackImage
  return (
    <motion.section
      className="relative isolate overflow-hidden px-5 py-10 sm:px-8 sm:py-14"
      style={{
        '--visual-accent': pulseVisual.accentRgb,
        '--visual-glow': pulseVisual.glowRgb,
      }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-65"
        style={{
          backgroundImage: `url("${pulseImage}")`,
          backgroundPosition: pulseVisual.objectPosition ?? 'center',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgb(7 10 18 / 0.62) 0%, rgb(7 10 18 / 0.86) 55%, rgb(7 10 18 / 0.96) 100%), radial-gradient(circle at 20% 10%, rgb(var(--visual-accent) / 0.18), transparent 30rem), radial-gradient(circle at 80% 5%, rgb(var(--visual-glow) / 0.10), transparent 26rem)',
        }}
      />
      <ParticleLayer density="normal" />
      <LateralKanjiPair kanji={{ left: '今', right: '動' }} visual={pulseVisual} intensity="soft" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            En vivo
          </span>
          <h2 className="text-[clamp(1.5rem,3.5vw,2.25rem)] tracking-tight">
            Ahora mismo
          </h2>
          <p className="max-w-2xl text-[14px] text-fg-muted">
            Torneos, duelos y rankings que se mueven mientras lees. Tu voto los empuja.
          </p>
        </div>

        {/* Fila superior: solo datos con señal real. Si el ranking tiene
            muy pocos votos o no hay movers, cambiamos a una accion clara
            en vez de enseñar "2 votos" / "sin movimientos". */}
        <div className={`mb-3 grid grid-cols-1 gap-3 md:mb-4 md:gap-4 ${mostrarMovers ? 'md:grid-cols-2' : ''}`}>
          {mostrarCampeon ? (
            <CampeonCard
              campeon={campeon}
              esFallback={false}
              loading={rankingLoading}
              comunidadArrancando={comunidadArrancando}
            />
          ) : (
            <DueloDestacadoCard duelo={duelo} torneoEnCurso={torneoEnCurso} />
          )}
          {mostrarMovers && <MoversCard movers={topMovers} />}
        </div>

        {/* Banner de evento headline. Solo aparece si hay un evento
            activo o próximo en data/eventos.js — sin nada, se omite
            sin dejar hueco. Full-width entre filas para que el "tema
            de la temporada" tenga su propio espacio. */}
        <EventoHeadlineBanner />

        {/* Banner personalizado del roster del user. Solo se renderiza
            si está logueado (3 estados: sin favoritos, sin movs, con
            movs). Para invitados queda invisible — Pulso global ya
            cubre la propuesta de valor sin extras. */}
        <FavoritosPulsoBanner />

        {/* Fila inferior: Reto + Torneo + Duelo + ÚltimosVotos.
            En md+ los 4 caben en una sola fila (cards ~280px en max-w-6xl);
            en sm pasan a 2 cols; en mobile stack vertical. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
          <RetoCard personaje={retoPersonaje} />
          <TorneoActivoCard torneo={torneoActivo} />
          <DueloAbiertoCard duelo={duelo} torneoEnCurso={torneoEnCurso} />
          <UltimosVotosCard votos={ultimosVotos} />
        </div>
      </div>
    </motion.section>
  )
}

function PulseCard({ tono = 'accent', children, ...rest }) {
  const tonos = {
    accent: {
      border: 'border-accent/34 hover:border-accent/70',
      glow: 'rgb(159 29 44 / 0.24)',
    },
    emerald: {
      border: 'border-emerald-500/34 hover:border-emerald-400/70',
      glow: 'rgb(16 185 129 / 0.22)',
    },
    amber: {
      border: 'border-amber-500/34 hover:border-amber-400/70',
      glow: 'rgb(245 158 11 / 0.24)',
    },
    cyan: {
      border: 'border-cyan-500/34 hover:border-cyan-400/70',
      glow: 'rgb(6 182 212 / 0.22)',
    },
    rose: {
      border: 'border-rose-500/34 hover:border-rose-400/70',
      glow: 'rgb(244 63 94 / 0.23)',
    },
    violet: {
      border: 'border-violet-500/34 hover:border-violet-400/70',
      glow: 'rgb(139 92 246 / 0.23)',
    },
  }
  const tone = tonos[tono] ?? tonos.accent
  return (
    <div
      className={`as-card-lift group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-surface/88 p-4 backdrop-blur-md sm:p-5 ${tone.border}`}
      style={{
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.055), 0 24px 80px -54px ${tone.glow}`,
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(circle at 88% 0%, ${tone.glow}, transparent 13rem), linear-gradient(180deg, rgb(255 255 255 / 0.035), transparent 42%)`,
        }}
      />
      {/* Feedback visual (2026-05-20): re-eliminado kanji 戦 fantasma que
          El bloque duplicado volvió a entrar en una iteración anterior. Las pulse-cards ya
          tienen identidad con su tone + glow + backdrop-blur, no necesitan
          glyph japones decorativo encima. */}
      {children}
    </div>
  )
}

function CardEyebrow({ icon: Icon, label, tono = 'text-gold' }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${tono}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function CampeonCard({ campeon, esFallback, loading, comunidadArrancando }) {
  if (loading || !campeon?.personaje) {
    return (
      <PulseCard tono="amber">
        {/* Label de loading neutro: el ranking se ordena por voto ponderado,
            así que "Líder del ranking" no promete una métrica incorrecta
            antes de que lleguen los datos. */}
        <CardEyebrow icon={Crown} label="Líder del ranking" tono="text-amber-300" />
        <p className="text-sm text-fg-muted">Cargando al líder…</p>
      </PulseCard>
    )
  }
  const p = campeon.personaje
  const votos = Number(campeon.votos ?? 0)
  // La métrica detrás es el TOP del endpoint /api/votos/ranking, ordenado
  // por SUM(v.peso) ponderado (anónimo 0.3, registrado 1.0). El campo
  // `votos` mostrado sigue siendo COUNT físico para no truncar números.
  // Distinguimos tres copys según contexto:
  //   - esFallback: backend sin votos → "Top del catálogo (ELO base)".
  //   - comunidadArrancando: muy pocos votos totales → "Más votado ahora".
  //   - normal: "Top de la comunidad" (orden ponderado).
  // CTA visible al ranking competitivo para el user que quiere el
  // "salón de la fama" completo.
  const eyebrow = esFallback
    ? 'Top del catálogo'
    : comunidadArrancando
      ? 'Más votado ahora'
      : 'Top de la comunidad'
  // Patrón "stretched link": el article es semántico
  // (article), y un Link absoluto invisible cubre toda la card. El CTA
  // interno a /ranking queda por encima con z-10, sigue siendo independiente.
  return (
    <article className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-amber-500/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-amber-500/60 sm:p-5">
      {/* Stretched link invisible que hace TODA la card clickeable.
          z-0 + el resto de elementos en z relativo (no absolute) =
          la card es accesible con teclado y screen-reader como un solo
          link a la ficha del personaje. */}
      <Link
        to={`/personajes/${p.slug}`}
        className="absolute inset-0 z-0"
        aria-label={`Ver ficha de ${p.nombre}`}
      />
      <CardEyebrow icon={Crown} label={eyebrow} tono="text-amber-300" />
      <div className="flex items-start gap-4">
        <PersonajeImg
          slug={p.slug}
          alt={p.nombre}
          className="h-28 w-20 shrink-0 rounded-lg object-cover object-top sm:h-32 sm:w-24"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="line-clamp-2 text-lg font-extrabold leading-tight text-fg-strong sm:text-xl">
            {p.nombre}
          </h3>
          <p className="text-[13px] text-fg-muted">{p.anime}</p>
          {esFallback ? (
            <p className="mt-2 font-mono text-2xl font-bold text-amber-300 tabular-nums">
              {Number(campeon.eloLocal ?? 0).toLocaleString('es-ES')}
              <span className="ml-1 text-[11px] font-medium uppercase text-fg-muted">
                ELO base
              </span>
            </p>
          ) : (
            <p className="mt-2 font-mono text-2xl font-bold text-amber-300 tabular-nums">
              {votos.toLocaleString('es-ES')}
              <span className="ml-1 text-[11px] font-medium uppercase text-fg-muted">
                {votos === 1 ? 'voto' : 'votos'}
              </span>
            </p>
          )}
          {comunidadArrancando ? (
            <p className="mt-1 text-[11px] leading-snug text-amber-200/70">
              Comunidad arrancando — tu voto puede cambiar el meta.
            </p>
          ) : (
            // El ranking REST se ordena por votos ponderados. Evitamos
            // llamarlo "ELO global" porque sugeriría un K-factor real.
            <p className="mt-1 text-[11px] leading-snug text-fg-muted">
              Top de la comunidad por votos ponderados.
            </p>
          )}
        </div>
      </div>
      {/* mt-auto + relative z-10 → el CTA queda POR ENCIMA del stretched
          link. Sin stopPropagation: ya no es necesario, no hay onClick
          en el padre. */}
      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 pt-1">
        <Link
          to="/ranking"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-muted hover:text-amber-300"
        >
          Ver ranking competitivo
          <ArrowRight className="h-3 w-3" />
        </Link>
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-300 opacity-0 transition-opacity group-hover:opacity-100">
          Ver ficha
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </article>
  )
}

function DueloDestacadoCard({ duelo, torneoEnCurso }) {
  const a = duelo?.personajeA
  const b = duelo?.personajeB
  const tieneDuelo = Boolean(a && b)
  const destino = tieneDuelo ? '/votar' : torneoEnCurso ? `/torneos/${torneoEnCurso.slug}` : '/votar'
  const titulo = tieneDuelo
    ? 'Vota el duelo que mueve el meta'
    : torneoEnCurso
      ? torneoEnCurso.nombre
      : 'Vota tu primer duelo del día'
  const subtitulo = tieneDuelo
    ? 'Dos personajes. Un click. Sin registro para empezar.'
    : torneoEnCurso
      ? 'Hay un bracket activo esperando votos de la comunidad.'
      : 'Elige favorito, mira el feedback y entra en la liga.'

  return (
    <Link
      to={destino}
      className="group relative flex min-h-[220px] flex-col gap-4 overflow-hidden rounded-xl border border-amber-500/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-amber-500/60 sm:p-5"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(circle at 18% 8%, rgb(197 161 90 / 0.20), transparent 16rem), radial-gradient(circle at 86% 0%, rgb(36 198 220 / 0.14), transparent 18rem), linear-gradient(180deg, rgb(255 255 255 / 0.035), transparent 45%)',
        }}
      />
      <CardEyebrow icon={Swords} label="Duelo destacado" tono="relative text-amber-300" />
      <div className="relative grid flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <h3 className="max-w-xl text-2xl font-black leading-tight tracking-tight text-fg-strong sm:text-3xl">
            {titulo}
          </h3>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-fg-muted">
            {subtitulo}
          </p>
        </div>
        {tieneDuelo ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <DestacadoAvatar personaje={a} />
            <span className="font-mono text-2xl font-black text-gold">VS</span>
            <DestacadoAvatar personaje={b} />
          </div>
        ) : (
          <div
            aria-hidden="true"
            lang="ja"
            className="flex h-24 w-24 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 font-mono text-5xl font-black text-amber-200"
          >
            戦
          </div>
        )}
      </div>
      <span className="relative mt-auto inline-flex items-center gap-1 text-sm font-bold text-amber-300 transition-transform group-hover:translate-x-0.5">
        {tieneDuelo ? 'Votar ahora' : 'Entrar'}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}

function DestacadoAvatar({ personaje }) {
  return (
    <div className="min-w-0 text-center">
      <PersonajeImg
        slug={personaje.slug}
        alt={personaje.nombre}
        className="mx-auto h-28 w-20 rounded-xl object-cover object-top shadow-[0_18px_55px_-32px_rgba(0,0,0,0.9)] sm:h-32 sm:w-24"
      />
      <p className="mt-2 line-clamp-1 max-w-24 text-[12px] font-bold text-fg-strong">
        {personaje.nombre}
      </p>
    </div>
  )
}

function MoversCard({ movers }) {
  // Sprint actividad reciente (2026-05-18): 1 request batch para los
  // 3 movers visibles — añade "+N votos" debajo del delta de posición.
  // Misma queryKey que otros consumidores del mismo set → cache hit.
  const slugs = movers.map((m) => m.slug)
  const { bySlug: votosBySlug } = useVotosPeriodoBatch(slugs, { dias: 7 })

  if (movers.length === 0) return null

  return (
    <PulseCard tono="emerald">
      <CardEyebrow icon={TrendingUp} label="Movers · 7 días" tono="text-emerald-300" />
      <ul className="flex flex-col divide-y divide-border">
        {movers.map((m) => (
          <MoverRow
            key={m.slug}
            mover={m}
            actividad={votosBySlug.get(m.slug)}
          />
        ))}
      </ul>
      <Link
        to="/ranking"
        className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-300 hover:text-emerald-200"
      >
        Ver ranking completo
        <ArrowRight className="h-3 w-3" />
      </Link>
    </PulseCard>
  )
}

function MoverRow({ mover, actividad }) {
  const subio = mover.delta > 0
  const Icon = subio ? TrendingUp : TrendingDown
  const colorClase = subio ? 'text-emerald-300' : 'text-rose-300'
  const votosPeriodo = actividad?.votosPeriodoActual ?? 0
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]">
      <Link to={`/personajes/${mover.slug}`} className="shrink-0 transition-transform hover:scale-105">
        <img
          src={mover.imagenUrl || imagenPersonaje(mover.slug)}
          alt={mover.nombre}
          loading="lazy"
          onError={ocultaImgRota}
          className="h-10 w-8 rounded object-cover object-top"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/personajes/${mover.slug}`}
          className="line-clamp-1 text-[13px] font-semibold text-fg-strong hover:text-gold"
        >
          {mover.nombre}
        </Link>
        <p className="line-clamp-1 text-[11px] text-fg-muted">
          {mover.anime}
          {votosPeriodo > 0 && (
            <span className="ml-1 font-mono tabular-nums text-emerald-300/80">
              · +{votosPeriodo} votos
            </span>
          )}
        </p>
      </div>
      <div
        className={`flex items-center gap-1 text-[13px] font-bold ${colorClase}`}
        title={`${subio ? 'Subió' : 'Bajó'} ${Math.abs(mover.delta)} posiciones · ${votosPeriodo} votos esta semana`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="tabular-nums">{Math.abs(mover.delta)}</span>
      </div>
    </li>
  )
}

function RetoCard() {
  const visual = getGameVisual('/games/shadow-guess', 'Shadow Guess')
  return (
    <Link
      to="/games/shadow-guess"
      // Feedback visual (2026-05-22): la card tenía altura natural ~180px
      // y el EditorialCover absolute inset-0 + el overlay degradado oscuro
      // del 38% al 92% dejaban solo ~70px de imagen visible — el usuario
      // lo describió como "tan finita que practicamente no se ve". Subimos
      // min-h a 13rem para que la franja superior tenga aire y el sujeto
      // del cover quepa antes de empezar el degradado de oscurecimiento.
      className="group relative flex min-h-[13rem] flex-col gap-3 overflow-hidden rounded-xl border border-rose-500/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-rose-500/60 sm:p-5"
    >
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0 opacity-95"
        imageClassName="saturate-110 contrast-105"
      />
      <CardEyebrow icon={Calendar} label="Reto del día" tono="relative text-rose-300" />
      <div className="relative mt-auto flex items-start gap-3">
        <div
          aria-hidden="true"
          lang="ja"
          className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md border border-rose-500/35 bg-bg/65 font-mono text-3xl font-black text-rose-200 shadow-[0_0_34px_-16px_rgba(159,29,44,0.9)]"
        >
          影
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-bold text-fg-strong drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
            Adivina la silueta
          </h3>
          <p className="text-[12px] leading-snug text-fg-muted">
            Cinco intentos. Cada fallo aclara un poco la imagen.
          </p>
        </div>
      </div>
      <span className="relative inline-flex items-center gap-1 text-[12px] font-semibold text-rose-300 transition-transform group-hover:translate-x-0.5">
        Jugar daily
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

function TorneoActivoCard({ torneo }) {
  if (!torneo) {
    return (
      <PulseCard tono="cyan">
        <CardEyebrow icon={Trophy} label="Torneo activo" tono="text-cyan-300" />
        <p className="text-[13px] text-fg-muted">
          Sin torneos en marcha ahora mismo. Lanzamos un nuevo bracket cada
          pocos días — vuelve pronto.
        </p>
      </PulseCard>
    )
  }
  const enCurso = torneo.estado === 'IN_PROGRESS'
  const estadoLabel = enCurso ? 'En curso' : 'Próximamente'
  const visual = getTournamentVisual(torneo.slug, torneo.nombre)
  return (
    <Link
      to={`/torneos/${torneo.slug}`}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-cyan-500/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-500/60 sm:p-5"
    >
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0 opacity-95"
        imageClassName="saturate-110 contrast-105"
      />
      <CardEyebrow icon={Trophy} label="Torneo activo" tono="relative text-cyan-300" />
      <div className="relative flex flex-col gap-1">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-tight text-fg-strong drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
          {torneo.nombre}
        </h3>
        <p className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              enCurso ? 'bg-emerald-400' : 'bg-cyan-400'
            }`}
          />
          {estadoLabel}
          {torneo.totalParticipantes ? (
            <>
              {' · '}
              {torneo.totalParticipantes} participantes
            </>
          ) : null}
        </p>
      </div>
      <span className="relative mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-cyan-300 transition-transform group-hover:translate-x-0.5">
        Ver bracket
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

function DueloAbiertoCard({ duelo, torneoEnCurso }) {
  // Sin duelo del endpoint /enfrentamientos/aleatorio: dos escenarios.
  //  1) Hay torneo IN_PROGRESS → es muy probable que sí queden duelos
  //     pendientes (el endpoint puede haber fallado o estar entre
  //     batches). NO digamos "sin duelos", redirigimos al bracket
  //     donde sí los hay.
  //  2) Sin torneo en curso → modo casual real, copy honesto.
  if (!duelo || !duelo.personajeA || !duelo.personajeB) {
    if (torneoEnCurso) {
      const visual = getTournamentVisual(torneoEnCurso.slug, torneoEnCurso.nombre)
      return (
        <Link
          to={`/torneos/${torneoEnCurso.slug}`}
          className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-accent/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/60 sm:p-5"
        >
          <EditorialCover
            visual={visual}
            className="absolute inset-0 rounded-none border-0 opacity-95"
            imageClassName="saturate-110 contrast-105"
          />
          <CardEyebrow icon={Swords} label="Duelos pendientes" />
          <p className="relative text-[13px] leading-snug text-fg-muted">
            Hay duelos esperando en{' '}
            <span className="font-semibold text-fg-strong">
              {torneoEnCurso.nombre}
            </span>
            . Entra al bracket y vota.
          </p>
          <span className="relative mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gold transition-transform group-hover:translate-x-0.5">
            Ir al bracket
            <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      )
    }
    return (
      <PulseCard tono="accent">
        <CardEyebrow icon={Swords} label="Modo casual" />
        <p className="text-[13px] text-fg-muted">
          Sin torneos abiertos ahora. Entra al modo casual y vota duelos
          random del catálogo.
        </p>
        <Link
          to="/votar"
          className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gold hover:text-gold"
        >
          Ir a votar
          <ArrowRight className="h-3 w-3" />
        </Link>
      </PulseCard>
    )
  }
  const a = duelo.personajeA
  const b = duelo.personajeB
  return (
    <Link
      to="/votar"
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-accent/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/60 sm:p-5"
    >
      <CardEyebrow icon={Sparkles} label="Duelo abierto" tono="text-gold" />
      <div className="flex items-center justify-center gap-3">
        <DueloAvatar personaje={a} />
        <span className="font-mono text-xl font-extrabold text-gold">VS</span>
        <DueloAvatar personaje={b} />
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gold transition-transform group-hover:translate-x-0.5">
        Vota tu favorito
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

function UltimosVotosCard({ votos }) {
  const items = (votos || []).slice(0, 4)
  if (items.length === 0) {
    return (
      <PulseCard tono="violet">
        <CardEyebrow icon={Radio} label="Últimos votos" tono="text-violet-300" />
        <p className="text-[13px] text-fg-muted">
          Esperando votos. Sé tú el primero del día.
        </p>
        <Link
          to="/votar"
          className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-violet-300 hover:text-violet-200"
        >
          Vota ahora
          <ArrowRight className="h-3 w-3" />
        </Link>
      </PulseCard>
    )
  }
  return (
    <PulseCard tono="violet">
      <CardEyebrow icon={Radio} label="Últimos votos" tono="text-violet-300" />
      <ul className="flex flex-col divide-y divide-border">
        {items.map((v, i) => (
          <VotoRow key={`${v.fecha}-${i}`} voto={v} />
        ))}
      </ul>
      <Link
        to="/ranking"
        className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-violet-300 hover:text-violet-200"
      >
        Ver ranking en vivo
        <ArrowRight className="h-3 w-3" />
      </Link>
    </PulseCard>
  )
}

function VotoRow({ voto }) {
  const { ganador, rival, username, fecha } = voto
  if (!ganador) return null
  return (
    <li className="flex items-center gap-2 py-2 text-[12px]">
      <Link to={`/personajes/${ganador.slug}`} className="shrink-0">
        <img
          src={ganador.imagenUrl || imagenPersonaje(ganador.slug)}
          alt={ganador.nombre}
          loading="lazy"
          onError={ocultaImgRota}
          className="h-7 w-7 rounded object-cover object-top"
        />
      </Link>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="line-clamp-1">
          <span className="font-semibold text-fg-strong">
            {username ?? 'alguien'}
          </span>{' '}
          <span className="text-fg-muted">votó por</span>{' '}
          <Link
            to={`/personajes/${ganador.slug}`}
            className="font-semibold text-fg-strong hover:text-gold"
          >
            {ganador.nombre}
          </Link>
          {rival && (
            <>
              {' '}
              <span className="text-fg-muted">vs</span>{' '}
              <Link
                to={`/personajes/${rival.slug}`}
                className="text-fg-muted hover:text-gold"
              >
                {rival.nombre}
              </Link>
            </>
          )}
        </p>
        {fecha && (
          <p className="text-[10px] text-fg-muted">{formatRelativo(fecha)}</p>
        )}
      </div>
    </li>
  )
}

/**
 * Formato relativo simple: "hace 3 min", "hace 2 h", "hace 5 d", o la
 * fecha corta si es más antiguo. No usamos Intl.RelativeTimeFormat porque
 * para 4-5 items render es overkill; el cálculo simple basta y los
 * timestamps llegan ya en local time del server.
 */
function formatRelativo(isoString) {
  try {
    const fecha = new Date(isoString)
    const ahora = Date.now()
    const segs = Math.floor((ahora - fecha.getTime()) / 1000)
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

function DueloAvatar({ personaje }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <PersonajeCutImg
        slug={personaje.slug}
        fallback={personaje.imagenUrl || imagenPersonaje(personaje.slug)}
        alt={personaje.nombre}
        loading="lazy"
        className="h-28 w-24 rounded-xl border border-accent/20"
        imgClassName="p-1"
      />
      <p className="line-clamp-1 max-w-full text-center text-[11px] font-semibold text-fg-strong">
        {personaje.nombre}
      </p>
    </div>
  )
}

/**
 * Banner del evento "headline" (Plan producto 2026-05-18). Muestra el
 * primer evento activo, o el próximo más cercano si no hay activos.
 * Auto-refresh del contador cada 60s para que "termina en 3h" baje a
 * "termina en 2h" sin recargar la página.
 */
function EventoHeadlineBanner() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const evento = getEventoHeadline(now)
  if (!evento) return null

  const estado = getEstadoEvento(evento, now)
  const ms = getMsRestantes(evento, now)
  const restante = formatRestante(ms)
  const participantes = getPersonajesEvento(evento).length
  const visual = getEventVisual(evento.slug, evento.titulo)

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

  const ctaLabel = estado === ESTADO_EVENTO.ACTIVO ? 'Entrar al evento' : 'Ver detalles'
  const tiempoLabel = estado === ESTADO_EVENTO.ACTIVO
    ? `Termina en ${restante}`
    : `Empieza en ${restante}`
  const eyebrowLabel = estado === ESTADO_EVENTO.ACTIVO ? 'Evento en curso' : 'Próximo evento'

  return (
    <div className={`relative mb-3 overflow-hidden rounded-xl border p-4 sm:mb-4 sm:p-5 ${tonoBg}`}>
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0 opacity-95"
        imageClassName="saturate-105 contrast-100"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <span className={`inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${tonoTexto}`}>
            <CalendarClock className="h-3 w-3" />
            {eyebrowLabel} · {tiempoLabel}
          </span>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-xl sm:text-2xl">
              {evento.emoji}
            </span>
            <h3 className="text-lg font-extrabold text-fg-strong drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] sm:text-xl">
              {evento.titulo}
            </h3>
          </div>
          <p className="line-clamp-2 text-[13px] text-fg-muted drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
            {evento.descripcionCorta} · {participantes} personajes
          </p>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <span className="rounded-full border border-white/10 bg-bg/55 px-3 py-1 font-mono text-[11px] font-bold text-fg-muted backdrop-blur">
            {participantes} participantes
          </span>
          <Link
            to={`/eventos/${evento.slug}`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-bg/40 px-4 py-2 text-[13px] font-semibold ${tonoTexto} hover:bg-bg/60`}
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SectionPulso
