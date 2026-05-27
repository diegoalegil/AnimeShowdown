import { Link } from 'react-router-dom'
import { ArrowRight, Trophy } from 'lucide-react'
import { getGameVisual } from '../../../data/visual-assets'
import GameCardBackground from './GameCardBackground'
import { COLOR_THEMES } from './games-hub-config'

export function CardDestacado({ game, estado }) {
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

export function CardMini({ game, estado }) {
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
        <p className="line-clamp-2 text-[12px] text-fg-muted drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
          {game.desc}
        </p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted/90">
          {game.cadencia}
        </p>
      </div>
    </Link>
  )
}

export function OmikujiCard() {
  const visual = getGameVisual('/omikuji', 'Omikuji diario')
  // Card del ritual diario con suficiente altura para que el cover tenga
  // presencia, manteniendo el kanji 御 y el CTA sobre el panel.
  return (
    <Link
      to="/omikuji"
      className="as-panel-hot group relative flex min-h-[9rem] items-center gap-4 overflow-hidden rounded-xl border border-accent/40 px-5 py-5 transition-all duration-300 hover:border-accent/60 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_22px_65px_-25px_rgba(159,29,44,0.55)] sm:min-h-[10rem]"
    >
      <GameCardBackground visual={visual} opacity={0.90} />
      <div
        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-accent/40 backdrop-blur-md sm:h-16 sm:w-16"
        style={{ background: 'linear-gradient(135deg, rgb(159 29 44 / 0.32) 0%, rgb(7 10 18 / 0.55) 100%)' }}
      >
        <span
          aria-hidden="true"
          lang="ja"
          className="font-mono text-2xl font-extrabold text-gold sm:text-3xl"
          style={{ textShadow: '0 0 18px currentColor, 0 2px 5px rgb(0 0 0 / 0.75)' }}
        >
          御
        </span>
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
