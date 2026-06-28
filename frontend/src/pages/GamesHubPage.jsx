import { useEffect, useState } from 'react'
import { Gamepad2 } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { useTodayKey } from '../hooks/useDailyGameState'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { getDailyResetCountdown } from '../lib/games'
import {
  listenDailyProgress,
  readDailyStreak,
  readRecentDailyProgress,
  setDailyGamesCompleted,
} from '../lib/dailyProgress'
import { shareWithToast } from '../lib/shareWithToast'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import DailyMissionPanel from '../components/DailyMissionPanel'
import DailyRulesDetails from '../features/games/hub/DailyRulesDetails'
import KanjiInkSplash from '../features/games/hub/KanjiInkSplash'
import {
  CardDestacado,
  CardMini,
  OmikujiCard,
} from '../features/games/hub/GamesHubCards'
import { GamesHubStatsBar } from '../features/games/hub/GamesHubStats'
import GamesHubSummaryBanner from '../features/games/hub/GamesHubSummaryBanner'
import StreakFlame from '../features/games/hub/StreakFlame'
import { leerEstadoJuego, leerMejorRacha } from '../features/games/hub/game-progress'
import { buildGamesHubPlan } from '../features/games/hub/games-hub-plan'
import { GAMES, gamesHubSchema } from '../features/games/hub/games-hub-config'

/**
 * Hub de modos de juego.
 *
 * Anime Daily Trials — daily challenges con identidad anime/SSR card.
 * Hero con stats (racha, completados hoy, reset), reto destacado del día
 * + retos secundarios + Omikuji integrado, todo leyendo estado desde
 * localStorage de cada juego.
 */

function GamesHubPage() {
  useSeo({
    title: 'Anime Daily Trials',
    description:
      'Retos diarios de anime: silueta borrosa, adivina el anime, Oráculo, AniGrid (Wordle), Nexo Anime, Impostor Trial, ELO Duel y Ruleta. Una ronda al día, protege tu racha.',
    canonical: 'https://animeshowdown.dev/games',
    image: BRAND_VISUALS.games.image,
  })

  const [reinicio, setReinicio] = useState(getDailyResetCountdown)
  const todayKey = useTodayKey()
  useEffect(() => {
    const id = setInterval(() => setReinicio(getDailyResetCountdown()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Releemos progreso local al volver al foco, cuando otra pestaña modifica
  // localStorage y cuando avanza el countdown. Así el reset de medianoche no
  // deja el hub mostrando completados del día anterior.
  const [, setEstadosTick] = useState(0)
  useEffect(() => {
    const refresh = () => setEstadosTick((t) => t + 1)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const [, setDailyProgressTick] = useState(0)
  useEffect(
    () => listenDailyProgress(() => setDailyProgressTick((tick) => tick + 1)),
    [],
  )

  const estadosJuegos = Object.fromEntries(
    GAMES.map((g) => [
      g.to,
      {
        ...leerEstadoJuego(g.storageKey),
        best: leerMejorRacha(g.bestKey),
      },
    ]),
  )

  const completadosHoy = Object.values(estadosJuegos).filter(
    (e) => e.completadoHoy,
  ).length
  const totalDaily = GAMES.filter((g) => !g.endless).length

  useEffect(() => {
    setDailyGamesCompleted(completadosHoy)
  }, [completadosHoy])

  // Se recalcula en cada render; el listener solo fuerza el render
  // cuando otra acción del ritual cambia localStorage en esta misma sesión.
  // 14 días: la llama de racha pinta dos semanas de calendario 完.
  const dailyHistory = readRecentDailyProgress(14, todayKey)
  const dailyStreak = readDailyStreak()

  const {
    destacado,
    otros,
  } = buildGamesHubPlan(GAMES, estadosJuegos)

  const compartirResumen = async () => {
    const completados = Object.entries(estadosJuegos)
      .filter(([, estado]) => estado.completadoHoy)
      .map(([to]) => GAMES.find((g) => g.to === to)?.titulo)
      .filter(Boolean)
    const texto = `Completé ${completadosHoy}/${totalDaily} Anime Daily Trials en AnimeShowdown — ${todayKey}${
      completados.length ? `\n${completados.join(', ')}` : ''
    }`
    await shareWithToast(
      {
        title: 'Anime Daily Trials',
        text: texto,
        url: '/games',
      },
      {
        clipboardSuccess: 'Resumen copiado',
        errorTitle: 'No se pudo compartir el resumen',
        nativeSuccess: 'Resumen compartido',
      },
    )
  }

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.games}
      className="py-8 sm:py-10"
      lateralKanji={{ left: '遊', right: '戯' }}
    >
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Daily Trials', path: '/games' },
        ])}
      />
      <JsonLd id="games-hub" schema={gamesHubSchema(GAMES)} />
      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.games}
          icon={Gamepad2}
          eyebrow="Anime Daily Trials"
          // El backdrop del hero es la tinta del reto del día: se ensambla en
          // su kanji y, al completarlo (el plan recalcula el destacado), se
          // desarma y rearma con el siguiente. Fallback estático integrado.
          fx={
            <KanjiInkSplash
              kanji={destacado?.kanji ?? BRAND_VISUALS.games.kanji}
              visual={BRAND_VISUALS.games}
            />
          }
          title="Retos diarios"
          subtitle="Una ronda al día. Una racha que proteger. Un ranking que escalar. Cada minijuego tiene portada propia y una identidad visual distinta."
          aside={
            <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 backdrop-blur-md">
              <p className="text-[11px] font-black text-gold">
                Reset diario
              </p>
              <p className="mt-3 font-mono text-4xl font-black text-fg-strong">
                {reinicio.label}
              </p>
              <p className="text-sm text-fg-muted">hasta que cambie la suerte.</p>
            </div>
          }
        />

        {/* V-6: los JUEGOS van PRIMERO, justo tras el hero. Antes el usuario
            entraba a misión/calendario/ritual —todo a cero en cuentas nuevas—
            y los retos quedaban al final, con sensación de "contenido vacío". */}

        {/* Reto destacado del día */}
        <section className="mb-6">
          <h2 className="mb-3 text-[11px] font-semibold text-fg-muted">
            Reto recomendado de hoy
          </h2>
          {destacado && (
            <CardDestacado game={destacado} estado={estadosJuegos[destacado.to]} />
          )}
        </section>

        {/* Otros retos de hoy */}
        <section className="mb-10">
          <h2 className="mb-3 text-[11px] font-semibold text-fg-muted">
            Otros retos de hoy
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {otros.map((g) => (
              <CardMini key={g.to} game={g} estado={estadosJuegos[g.to]} />
            ))}
          </div>
        </section>

        {/* Ritual diario (omikuji): suerte narrativa del día, sin mecánica que
            afecte a los retos. Va debajo de los juegos pero antes que misión/stats. */}
        <section className="mb-6">
          <h2 className="mb-3 text-[11px] font-semibold text-fg-muted">
            Ritual diario
          </h2>
          <OmikujiCard />
        </section>

        <DailyMissionPanel compact className="mb-6 hidden md:block" />

        <GamesHubSummaryBanner
          completadosHoy={completadosHoy}
          totalDaily={totalDaily}
          onShare={compartirResumen}
        />

        <GamesHubStatsBar
          completadosHoy={completadosHoy}
          totalDaily={totalDaily}
          eloBest={estadosJuegos['/games/elo-duel']?.best}
          resetLabel={reinicio.label}
        />

        {/* La llama de racha sustituye a la tira plana de historial: nivel
            visual por días (brasa → llama → llama doble), calendario 完 de
            dos semanas con datos REALES y aviso ámbar si la racha corre
            peligro. A racha 0 (cuenta nueva) NO se oculta: muestra una brasa
            aspiracional que invita a encender la primera llama hoy. */}
        <div className="mt-6 flex justify-center">
          <StreakFlame
            streakDays={dailyStreak.current}
            playedToday={dailyStreak.lastCompletedDate === todayKey}
            hoursLeft={reinicio.h + reinicio.m / 60}
            history={dailyHistory.map((d) => Boolean(d?.completed))}
          />
        </div>

        <DailyRulesDetails />

        <p className="mt-8 max-w-3xl text-sm leading-7 text-fg-muted">
          Anime Daily Trials reúne juegos breves para volver cada día: adivinar
          personajes, reconocer animes, resolver una grilla, detectar impostores
          y comparar ELO. Cada reto guarda progreso local, aporta misiones y
          ofrece resultados compartibles sin convertir el hub en una página de
          instrucciones larga.
        </p>
      </div>
    </VisualPageShell>
  )
}

export default GamesHubPage
