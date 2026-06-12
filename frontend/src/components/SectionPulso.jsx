import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { endpoints, ApiError } from '../lib/api'
import { useTorneos } from '../lib/torneosQueries'
import { imagenPersonaje, personajes, getStatsPersonaje } from '../lib/personajes-core'
import { personajeDelDia } from '../lib/games'
import ResponsivePicture from './ResponsivePicture'
import FavoritosPulsoBanner from './FavoritosPulsoBanner'
import { PULSE_STALE, useRankingPulso } from '../features/home/pulso/pulsoQueries'
import CampeonCard from '../features/home/pulso/components/CampeonCard'
import DueloAbiertoCard from '../features/home/pulso/components/DueloAbiertoCard'
import DueloDestacadoCard from '../features/home/pulso/components/DueloDestacadoCard'
import EventoHeadlineBanner from '../features/home/pulso/components/EventoHeadlineBanner'
import MoversCard from '../features/home/pulso/components/MoversCard'
import RetoCard from '../features/home/pulso/components/RetoCard'
import TorneoActivoCard from '../features/home/pulso/components/TorneoActivoCard'
import UltimosVotosCard from '../features/home/pulso/components/UltimosVotosCard'
import { BRAND_VISUALS } from '../data/visual-assets'
import { LateralKanjiPair, ParticleLayer } from './VisualSystem'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'

/**
 * Campeón fallback derivado del catálogo local. Útil cuando el ranking
 * del backend está vacío (DB nueva, dev local sin seed de votos): la
 * card "Campeón actual" sigue mostrando algo coherente — el personaje
 * con mayor ELO base del catálogo, marcado como "Top del catálogo"
 * para no mentir presentándolo como votado por la comunidad.
 */
function crearCampeonFallback(catalogoPersonajes) {
  const top = [...catalogoPersonajes]
    .filter((p) =>
      tieneImagenPromocionable({ personaje: p }, catalogoPersonajes),
    )
    .map((p) => ({ ...p, elo: getStatsPersonaje(p.slug).elo }))
    .sort((a, b) => b.elo - a.elo)[0]
  return top
    ? {
        personaje: {
          slug: top.slug,
          nombre: top.nombre,
          anime: top.anime,
          imagenUrl: top.imagenUrl ?? top.imagen ?? imagenPersonaje(top.slug),
        },
        eloLocal: top.elo,
      }
    : null
}

function tieneImagenPromocionable(item, catalogoPersonajes = personajes) {
  const p = item?.personaje ?? item
  const local = p?.slug
    ? catalogoPersonajes.find((personaje) => personaje.slug === p.slug)
    : null
  const imagen = p?.imagenUrl ?? local?.imagenUrl ?? local?.imagen
  return Boolean(imagen && !imagen.includes('/_missing/') && !imagen.includes('placeholder'))
}

/**
 * Pulso AnimeShowdown — sección "live" en la home.
 *
 * <p>Nota de producto: la home antes mostraba un duelo random
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
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const { data: ranking, isLoading: rankingLoading } = useRankingPulso()
  const { data: movimientos } = useMovimientos()
  const { data: torneos = [] } = useTorneos()
  const { data: duelo } = useDueloAbierto()
  const { data: ultimosVotos } = useUltimosVotos()

  // Campeón real si el backend tiene votos; si no, fallback al top del
  // catálogo. Distinguimos visualmente con flag esFallback.
  const campeonReal = Array.isArray(ranking)
    ? ranking.find((item) => tieneImagenPromocionable(item, catalogoPersonajes))
    : null
  const campeonFallback = useMemo(
    () => crearCampeonFallback(catalogoPersonajes),
    [catalogoPersonajes],
  )
  const campeon = campeonReal ?? campeonFallback
  const esFallback = !campeonReal
  // Nota de producto: el backend devuelve top por COUNT(votos),
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
    (!esFallback &&
      votosCampeon >= 10 &&
      campeon?.personaje &&
      tieneImagenPromocionable(campeon, catalogoPersonajes))
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
      <ResponsivePicture
        visual={pulseVisual}
        src={pulseImage}
        sizes="100vw"
        className="absolute inset-0 opacity-65"
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
          {/* Estado inline con dot sólido y texto normal para evitar ruido visual. */}
          <span className="inline-flex w-fit items-center gap-2 text-sm font-medium text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
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

export default SectionPulso
