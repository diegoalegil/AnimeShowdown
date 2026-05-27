import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Flame,
  Gamepad2,
  Hourglass,
  Share2,
  Trophy,
} from 'lucide-react'
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
import { BRAND_VISUALS, getGameVisual } from '../data/visual-assets'
import DailyMissionPanel from '../components/DailyMissionPanel'
import GameCardBackground from '../features/games/hub/GameCardBackground'
import { leerEstadoJuego, leerMejorRacha } from '../features/games/hub/game-progress'
import {
  COLOR_THEMES,
  GAMES,
  gamesHubSchema,
} from '../features/games/hub/games-hub-config'

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
    <VisualPageShell visual={BRAND_VISUALS.games} className="py-8 sm:py-10" lateralKanji={{left: "遊", right: "戯"}}>
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

        <DailyMissionPanel compact className="mb-6 hidden md:block" />

        {completadosHoy > 0 && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-fg-strong">
                Hoy completaste {completadosHoy}/{totalDaily} daily trials.
              </p>
              <p className="text-[12px] text-fg-muted">
                Guarda el ritual: comparte el resumen o salta a votar para cerrar la misión.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={compartirResumen}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-[13px] font-black text-emerald-100 transition-colors hover:bg-emerald-500/25"
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartir resumen
              </button>
              <Link
                to="/votar"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-bold text-fg-strong transition-colors hover:border-accent hover:text-gold"
              >
                Votar duelos
              </Link>
            </div>
          </div>
        )}

        {/* Stats bar — racha hoy, mejor récord, countdown reinicio */}
        <div className="as-panel mb-6 grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-3 sm:p-5">
          <StatTile
            icon={Flame}
            iconColor="text-orange-400"
            label="Completados hoy"
            value={`${completadosHoy}/${totalDaily}`}
          />
          <StatTile
            icon={Trophy}
            iconColor="text-yellow-400"
            label="Mejor racha ELO Duel"
            value={
              estadosJuegos['/games/elo-duel']?.best != null
                ? `${estadosJuegos['/games/elo-duel'].best}`
                : '—'
            }
          />
          <StatTile
            icon={Hourglass}
            iconColor="text-cyan-400"
            label="Próximo reset"
            value={reinicio.label}
            className="col-span-2 sm:col-span-1"
          />
        </div>

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

        <details className="group rounded-xl border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">
                Detalles del reto diario
              </h3>
              <p className="mt-1 text-[12px] text-fg-muted">
                Reglas de reset, progreso local y resultado compartible.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-gold transition-transform group-open:rotate-90" />
          </summary>
          <ul className="flex flex-col gap-1.5 border-t border-border px-4 pb-4 pt-3 text-[13px] text-fg-muted">
            <li>
              · El personaje del día se elige <strong>determinísticamente</strong> por
              fecha local. Todos jugamos contra el mismo.
            </li>
            <li>
              · Reset a medianoche de tu zona horaria. Tu progreso vive en este
              navegador (localStorage, sin tracking).
            </li>
            <li>
              · Al final puedes copiar tu resultado con kanji y compartirlo
              donde quieras.
            </li>
          </ul>
        </details>
      </div>
    </VisualPageShell>
  )
}

function StatTile({ icon: Icon, iconColor, label, value, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-alt">
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
          {label}
        </p>
        <p className="truncate font-mono text-lg font-extrabold tabular-nums text-fg-strong">
          {value}
        </p>
      </div>
    </div>
  )
}

function DailyHistoryStrip({ days, streak }) {
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        weekday: 'short',
      }),
    [],
  )
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short',
      }),
    [],
  )

  return (
    <section className="as-panel mb-6 rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gold">
            Calendario daily
          </p>
          <h2 className="mt-1 text-lg font-black text-fg-strong">
            Últimos 7 días de ritual
          </h2>
        </div>
        <p className="text-[12px] text-fg-muted">
          Racha actual <span className="font-mono font-black text-gold">{streak.current}</span>
          {' '}· récord <span className="font-mono font-black text-fg-strong">{streak.longest}</span>
        </p>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const parsed = new Date(`${day.date}T12:00:00`)
          const completed = day.completed
          const started = day.votes > 0 || day.gamesCompleted > 0 || day.rankingViewed
          return (
            <div
              key={day.date}
              className={`min-h-[5.75rem] rounded-xl border px-2 py-2 text-center ${
                completed
                  ? 'border-emerald-400/35 bg-emerald-500/10'
                  : started
                    ? 'border-gold/35 bg-gold-soft'
                    : 'border-border bg-bg/45'
              }`}
              title={`${dateFormatter.format(parsed)} · ${
                completed
                  ? 'ritual completado'
                  : started
                    ? 'ritual empezado'
                    : 'sin progreso'
              }`}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.08em] text-fg-muted">
                {dayFormatter.format(parsed)}
              </p>
              <p
                className={`mt-2 font-mono text-xl font-black ${
                  completed
                    ? 'text-emerald-200'
                    : started
                      ? 'text-gold'
                      : 'text-fg-muted'
                }`}
              >
                {completed ? '✓' : started ? '•' : '—'}
              </p>
              <p className="mt-2 text-[10px] leading-4 text-fg-muted">
                {Math.min(day.votes, 10)}/10 votos
                <br />
                {Math.min(day.gamesCompleted, 1)}/1 daily
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CardDestacado({ game, estado }) {
  const Icon = game.icon
  const theme = COLOR_THEMES[game.color]
  const done = estado?.completadoHoy
  const visual = getGameVisual(game.to, game.titulo)
  // La imagen es protagonista (min-h-44); el kanji queda como badge inferior
  // con glow y el texto descansa sobre un panel translúcido para legibilidad.
  return (
    <Link
      to={game.to}
      className={`as-panel-hot group relative flex min-h-[14rem] flex-col justify-end overflow-hidden rounded-2xl border p-6 transition-all duration-300 motion-safe:hover:-translate-y-1 sm:min-h-[18rem] sm:p-8 ${theme.border} ${theme.hoverGlow}`}
    >
      <GameCardBackground visual={visual} opacity={0.95} />

      {/* Kanji decorativo grande detrás (mood), no panel separado */}
      <span
        aria-hidden="true"
        lang="ja"
        className={`pointer-events-none absolute -right-6 -top-8 select-none font-mono text-[7rem] font-black leading-none opacity-15 sm:text-[10rem] ${theme.text}`}
        style={{ textShadow: '0 0 60px currentColor' }}
      >
        {game.kanji}
      </span>

      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border bg-bg/55 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur-md ${theme.border} ${theme.text}`}
          >
            <Icon className="h-3 w-3" />
            {game.rarity} · Reto del día
          </span>
          {done && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200 backdrop-blur-md">
              ✓ Completado
            </span>
          )}
        </div>
        <h3 className="text-2xl font-extrabold leading-tight text-fg-strong drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)] sm:text-4xl">
          {game.titulo}
        </h3>
        <p className="max-w-lg text-[13px] text-fg-muted drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] sm:text-sm">
          {game.desc}
        </p>
        <p className={`inline-flex items-center gap-1 text-[12px] font-semibold ${theme.text}`}>
          {done ? 'Ver resultado' : 'Jugar ahora'}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </p>
      </div>
    </Link>
  )
}

function CardMini({ game, estado }) {
  const Icon = game.icon
  const theme = COLOR_THEMES[game.color]
  const done = estado?.completadoHoy
  const best = estado?.best
  const visual = getGameVisual(game.to, game.titulo)
  // Card mini de juego con portada cinematográfica visible antes del degradado,
  // para que cada juego se identifique por su arte y no solo por el kanji.
  return (
    <Link
      to={game.to}
      className={`as-panel group relative flex min-h-[12rem] flex-col justify-end overflow-hidden rounded-xl border p-5 transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_20px_55px_-25px_rgba(0,0,0,0.85)] sm:min-h-[13rem] ${theme.border} ${theme.hoverGlow}`}
    >
      <GameCardBackground visual={visual} opacity={0.92} />

      {/* Kanji decorativo en background sin panel separado */}
      <span
        aria-hidden="true"
        lang="ja"
        className={`pointer-events-none absolute -right-3 -top-5 select-none font-mono text-[5rem] font-extrabold leading-none opacity-20 sm:text-[6rem] ${theme.text}`}
        style={{ textShadow: '0 0 40px currentColor' }}
      >
        {game.kanji}
      </span>

      <div className="relative min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border bg-bg/55 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] backdrop-blur-md ${theme.border} ${theme.text}`}
          >
            <Icon className="h-2.5 w-2.5" />
            {game.rarity}
          </span>
          {done && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-200 backdrop-blur-md">
              ✓
            </span>
          )}
          {best != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-yellow-200 backdrop-blur-md">
              <Trophy className="h-2.5 w-2.5" />
              Récord {best}
            </span>
          )}
        </div>
        <h3 className="truncate text-base font-bold text-fg-strong drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] group-hover:text-gold">
          {game.titulo}
        </h3>
        <p className="line-clamp-2 text-[12px] text-fg-muted drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">{game.desc}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted/90">
          {game.cadencia}
        </p>
      </div>
    </Link>
  )
}

function OmikujiCard() {
  const visual = getGameVisual('/omikuji', 'Omikuji diario')
  // Card del ritual diario con suficiente altura para que el cover tenga
  // presencia, manteniendo el kanji 御 y el CTA sobre el panel.
  return (
    <Link
      to="/omikuji"
      className="as-panel-hot group relative flex min-h-[9rem] items-center gap-4 overflow-hidden rounded-xl border border-accent/40 px-5 py-5 transition-all duration-300 hover:border-accent/60 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_22px_65px_-25px_rgba(159,29,44,0.55)] sm:min-h-[10rem]"
    >
      <GameCardBackground visual={visual} opacity={0.90} />
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-accent/40 backdrop-blur-md sm:h-16 sm:w-16"
        style={{ background: 'linear-gradient(135deg, rgb(159 29 44 / 0.32) 0%, rgb(7 10 18 / 0.55) 100%)' }}
      >
        <span
          aria-hidden="true"
          lang="ja"
          className="font-mono text-2xl font-extrabold text-gold sm:text-3xl"
          style={{ textShadow: '0 0 18px currentColor, 0 2px 5px rgb(0 0 0 / 0.75)' }}
        >御</span>
      </div>
      <div className="relative flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold/90">
          Ritual diario
        </p>
        <h3 className="mt-1 text-lg font-bold text-fg-strong drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)] group-hover:text-gold sm:text-xl">
          Omikuji diario
        </h3>
        <p className="mt-1 text-[13px] text-fg-muted drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)]">
          Tira tu suerte del día al estilo de los santuarios japoneses.
        </p>
      </div>
      <ArrowRight className="relative h-5 w-5 text-gold transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

export default GamesHubPage
