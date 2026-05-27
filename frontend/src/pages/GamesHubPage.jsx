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
import {
  CardDestacado,
  CardMini,
  OmikujiCard,
} from '../features/games/hub/GamesHubCards'
import {
  DailyHistoryStrip,
  GamesHubStatsBar,
} from '../features/games/hub/GamesHubStats'
import GamesHubSummaryBanner from '../features/games/hub/GamesHubSummaryBanner'
import { leerEstadoJuego, leerMejorRacha } from '../features/games/hub/game-progress'
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
      'Retos diarios de anime: silueta borrosa, adivina el anime, AniGrid (Wordle), Impostor Trial y ELO Duel. Una ronda al día, una racha que proteger.',
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
  const dailyHistory = readRecentDailyProgress(7, todayKey)
  const dailyStreak = readDailyStreak()

  const destacado = GAMES.find((g) => g.destacado) ?? GAMES[0]
  const otros = GAMES.filter((g) => g.to !== destacado.to)

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
          title="Retos diarios"
          subtitle="Una ronda al día. Una racha que proteger. Un ranking que escalar. Cada minijuego tiene portada propia y una identidad visual distinta."
          aside={
            <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 backdrop-blur-md">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
                Reset diario
              </p>
              <p className="mt-3 font-mono text-4xl font-black text-fg-strong">
                {reinicio.label}
              </p>
              <p className="text-sm text-fg-muted">hasta que cambie la suerte.</p>
            </div>
          }
        />

        <p className="mb-6 max-w-3xl text-sm leading-7 text-fg-muted">
          Anime Daily Trials reúne juegos breves para volver cada día: adivinar
          personajes, reconocer animes, resolver una grilla, detectar impostores
          y comparar ELO. Cada reto guarda progreso local, aporta misiones y
          ofrece resultados compartibles sin convertir el hub en una página de
          instrucciones larga.
        </p>

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

        <DailyHistoryStrip days={dailyHistory} streak={dailyStreak} />

        {/* Nota de producto: el Omikuji va PRIMERO ahora.
            Sentido: el ritual diario abre el día — el palito que sacas
            puede regalarte la pista gratis de los retos de abajo. Antes
            estaba al final, justo después de los retos, lo cual era
            absurdo (¿de qué te sirve la pista si ya jugaste todo?). */}
        <section className="mb-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
            Ritual diario
          </h2>
          <OmikujiCard />
        </section>

        {/* Reto destacado del día */}
        <section className="mb-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
            Reto recomendado de hoy
          </h2>
          <CardDestacado game={destacado} estado={estadosJuegos[destacado.to]} />
        </section>

        {/* Otros retos de hoy */}
        <section className="mb-10">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
            Otros retos de hoy
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {otros.map((g) => (
              <CardMini key={g.to} game={g} estado={estadosJuegos[g.to]} />
            ))}
          </div>
        </section>

        <DailyRulesDetails />
      </div>
    </VisualPageShell>
  )
}

export default GamesHubPage
