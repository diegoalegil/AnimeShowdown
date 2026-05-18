import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  Crown,
  Radio,
  Sparkles,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { endpoints, ApiError } from '../lib/api'
import { useTorneos } from '../lib/torneosQueries'
import { imagenPersonaje, personajes, getStatsPersonaje } from '../data/personajes'
import { personajeDelDia } from '../lib/games'

/**
 * Campeón fallback derivado del catálogo local. Útil cuando el ranking
 * del backend está vacío (DB nueva, dev local sin seed de votos): la
 * card "Campeón actual" sigue mostrando algo coherente — el personaje
 * con mayor ELO base del catálogo, marcado como "Top del catálogo"
 * para no mentir presentándolo como votado por la comunidad.
 */
const CAMPEON_FALLBACK = (() => {
  const top = [...personajes]
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

/**
 * Pulso AnimeShowdown — sección "live" en la home.
 *
 * <p>Audit producto (2026-05-18): la home antes mostraba un duelo random
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
  return useQuery({
    queryKey: ['pulso', 'movimientos', 7],
    queryFn: () => endpoints.rankingMovimientos({ dias: 7, limit: 20 }),
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
  const campeonReal = ranking?.[0]
  const campeon = campeonReal ?? CAMPEON_FALLBACK
  const esFallback = !campeonReal
  const topMovers = (movimientos || [])
    .filter((m) => m.delta != null && m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
  const torneoActivo =
    torneos.find((t) => t.estado === 'IN_PROGRESS') ??
    torneos.find((t) => t.estado === 'SCHEDULED')
  const retoPersonaje = personajeDelDia('guess-character')

  return (
    <motion.section
      className="px-5 py-10 sm:px-8 sm:py-14"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            En vivo
          </span>
          <h2 className="text-[clamp(1.5rem,3.5vw,2.25rem)] tracking-tight">
            Pulso de AnimeShowdown
          </h2>
          <p className="max-w-2xl text-[14px] text-fg-muted">
            Qué está pasando ahora: campeón actual, movimientos de la semana,
            torneo en marcha y duelo abierto esperando tu voto.
          </p>
        </div>

        {/* Fila superior: Campeón (más grande) + Movers de la semana */}
        <div className="mb-3 grid grid-cols-1 gap-3 md:mb-4 md:grid-cols-2 md:gap-4">
          <CampeonCard campeon={campeon} esFallback={esFallback} loading={rankingLoading} />
          <MoversCard movers={topMovers} />
        </div>

        {/* Fila inferior: Reto + Torneo + Duelo + ÚltimosVotos.
            En md+ los 4 caben en una sola fila (cards ~280px en max-w-6xl);
            en sm pasan a 2 cols; en mobile stack vertical. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
          <RetoCard personaje={retoPersonaje} />
          <TorneoActivoCard torneo={torneoActivo} />
          <DueloAbiertoCard duelo={duelo} />
          <UltimosVotosCard votos={ultimosVotos} />
        </div>
      </div>
    </motion.section>
  )
}

function PulseCard({ tono = 'accent', children, ...rest }) {
  const tonos = {
    accent: 'border-accent/30 hover:border-accent/60',
    emerald: 'border-emerald-500/30 hover:border-emerald-500/60',
    amber: 'border-amber-500/30 hover:border-amber-500/60',
    cyan: 'border-cyan-500/30 hover:border-cyan-500/60',
    rose: 'border-rose-500/30 hover:border-rose-500/60',
    violet: 'border-violet-500/30 hover:border-violet-500/60',
  }
  return (
    <div
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-surface p-4 transition-all hover:-translate-y-0.5 sm:p-5 ${tonos[tono]}`}
      {...rest}
    >
      {children}
    </div>
  )
}

function CardEyebrow({ icon: Icon, label, tono = 'text-accent' }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${tono}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function CampeonCard({ campeon, esFallback, loading }) {
  if (loading || !campeon?.personaje) {
    return (
      <PulseCard tono="amber">
        <CardEyebrow icon={Crown} label="Campeón actual" tono="text-amber-300" />
        <p className="text-sm text-fg-muted">Cargando al rey del ranking…</p>
      </PulseCard>
    )
  }
  const p = campeon.personaje
  const votos = Number(campeon.votos ?? 0)
  // Etiqueta dinámica: si vino del backend ranking, "Campeón actual";
  // si es fallback local sin votos en backend, "Top del catálogo" para
  // no presentarlo falsamente como votado por la comunidad.
  const eyebrow = esFallback ? 'Top del catálogo' : 'Campeón actual'
  return (
    <Link
      to={`/personajes/${p.slug}`}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-amber-500/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-amber-500/60 sm:p-5"
    >
      <CardEyebrow icon={Crown} label={eyebrow} tono="text-amber-300" />
      <div className="flex items-start gap-4">
        <img
          src={p.imagenUrl || imagenPersonaje(p.slug)}
          alt=""
          loading="lazy"
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
                votos
              </span>
            </p>
          )}
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-300 opacity-0 transition-opacity group-hover:opacity-100">
        Ver ficha
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

function MoversCard({ movers }) {
  return (
    <PulseCard tono="emerald">
      <CardEyebrow icon={TrendingUp} label="Movers · 7 días" tono="text-emerald-300" />
      {movers.length === 0 ? (
        <p className="flex-1 text-sm text-fg-muted">
          Sin movimientos significativos esta semana. Empezarán a aparecer
          conforme la comunidad vote.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {movers.map((m) => (
            <MoverRow key={m.slug} mover={m} />
          ))}
        </ul>
      )}
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

function MoverRow({ mover }) {
  const subio = mover.delta > 0
  const Icon = subio ? TrendingUp : TrendingDown
  const colorClase = subio ? 'text-emerald-300' : 'text-rose-300'
  return (
    <li className="flex items-center gap-3 py-2">
      <Link to={`/personajes/${mover.slug}`} className="shrink-0">
        <img
          src={mover.imagenUrl || imagenPersonaje(mover.slug)}
          alt=""
          loading="lazy"
          className="h-10 w-8 rounded object-cover object-top"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/personajes/${mover.slug}`}
          className="line-clamp-1 text-[13px] font-semibold text-fg-strong hover:text-accent"
        >
          {mover.nombre}
        </Link>
        <p className="line-clamp-1 text-[11px] text-fg-muted">{mover.anime}</p>
      </div>
      <div className={`flex items-center gap-1 text-[13px] font-bold ${colorClase}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="tabular-nums">{Math.abs(mover.delta)}</span>
      </div>
    </li>
  )
}

function RetoCard({ personaje }) {
  return (
    <Link
      to="/games/shadow-guess"
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-rose-500/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-rose-500/60 sm:p-5"
    >
      <CardEyebrow icon={Calendar} label="Reto del día" tono="text-rose-300" />
      <div className="flex items-start gap-3">
        <div
          className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-bg"
          aria-hidden="true"
        >
          <img
            src={imagenPersonaje(personaje.slug)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top"
            style={{ filter: 'blur(10px)', transform: 'scale(1.1)' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-bold text-fg-strong">
            Adivina la silueta
          </h3>
          <p className="text-[12px] leading-snug text-fg-muted">
            Cinco intentos. Cada fallo nítida un poco la imagen.
          </p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-rose-300 transition-transform group-hover:translate-x-0.5">
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
  return (
    <Link
      to={`/torneos/${torneo.slug}`}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-cyan-500/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-500/60 sm:p-5"
    >
      <CardEyebrow icon={Trophy} label="Torneo activo" tono="text-cyan-300" />
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-tight text-fg-strong">
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
      <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-cyan-300 transition-transform group-hover:translate-x-0.5">
        Ver bracket
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

function DueloAbiertoCard({ duelo }) {
  if (!duelo || !duelo.personajeA || !duelo.personajeB) {
    return (
      <PulseCard tono="accent">
        <CardEyebrow icon={Swords} label="Duelo abierto" />
        <p className="text-[13px] text-fg-muted">
          Sin duelos abiertos ahora. Empieza un torneo o entra al modo
          casual.
        </p>
        <Link
          to="/votar"
          className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:text-accent-hover"
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
      <CardEyebrow icon={Sparkles} label="Duelo abierto" tono="text-accent" />
      <div className="flex items-center justify-center gap-3">
        <DueloAvatar personaje={a} />
        <span className="font-mono text-xl font-extrabold text-accent">VS</span>
        <DueloAvatar personaje={b} />
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-accent transition-transform group-hover:translate-x-0.5">
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
          alt=""
          loading="lazy"
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
            className="font-semibold text-fg-strong hover:text-accent"
          >
            {ganador.nombre}
          </Link>
          {rival && (
            <>
              {' '}
              <span className="text-fg-muted">vs</span>{' '}
              <Link
                to={`/personajes/${rival.slug}`}
                className="text-fg-muted hover:text-accent"
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
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <img
        src={personaje.imagenUrl || imagenPersonaje(personaje.slug)}
        alt=""
        loading="lazy"
        className="h-16 w-12 rounded-md object-cover object-top"
      />
      <p className="line-clamp-1 max-w-full text-center text-[11px] font-semibold text-fg-strong">
        {personaje.nombre}
      </p>
    </div>
  )
}

export default SectionPulso
