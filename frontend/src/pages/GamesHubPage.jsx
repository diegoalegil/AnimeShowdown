import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  Flame,
  Gamepad2,
  Grid3X3,
  Hourglass,
  Sparkles,
  Trophy,
  TrendingUp,
  Type,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { ELO_DUEL_BEST_KEY, fechaDelDia, safeStorage } from '../lib/games'
import EditorialCover from '../components/EditorialCover'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS, getGameVisual } from '../data/visual-assets'

/**
 * Hub de modos de juego.
 *
 * Anime Daily Trials — daily challenges con identidad anime/SSR card.
 * Hero con stats (racha, completados hoy, reset), reto destacado del día
 * + retos secundarios + Omikuji integrado, todo leyendo estado desde
 * localStorage de cada juego.
 */

// Datos descriptivos de cada juego. El kanji decora la mini-card SSR.
const GAMES = [
  {
    to: '/games/shadow-guess',
    icon: Eye,
    color: 'rose',
    kanji: '影',
    titulo: 'Shadow Guess',
    sub: 'Guess the Character',
    desc: 'Silueta borrosa de un personaje. 5 intentos antes de que aparezca nítido. Acierta antes para más puntos.',
    cadencia: '1 partida al día',
    storageKey: 'animeshowdown.guess-character.v1',
    rarity: 'SSR',
    destacado: true, // Reto principal del día
  },
  {
    to: '/games/anime-reveal',
    icon: Type,
    color: 'amber',
    kanji: '謎',
    titulo: 'Anime Reveal',
    sub: 'Guess the Anime',
    desc: 'Ves al personaje pero no su anime. Pistas opcionales: nombre, ELO, anime relacionado.',
    cadencia: '1 partida al día',
    storageKey: 'animeshowdown.guess-anime.v1',
    rarity: 'SR',
  },
  {
    to: '/games/anigrid',
    icon: Grid3X3,
    color: 'emerald',
    kanji: '格',
    titulo: 'AniGrid',
    sub: 'Anidel',
    desc: 'Wordle de personajes anime. 6 intentos. Pistas opcionales gastan un intento.',
    cadencia: 'Estilo Wordle',
    storageKey: 'animeshowdown.anidel.v1',
    rarity: 'SR',
  },
  {
    to: '/games/impostor-trial',
    icon: Sparkles,
    color: 'purple',
    kanji: '裏',
    titulo: 'Impostor Trial',
    sub: 'Detector de Impostor',
    desc: '4 personajes del mismo anime + 1 traidor de otro. Detéctalo en 3 rondas.',
    cadencia: '3 rondas al día',
    storageKey: 'animeshowdown.impostor.v1',
    rarity: 'SR',
  },
  {
    to: '/games/elo-duel',
    icon: TrendingUp,
    color: 'cyan',
    kanji: '戦',
    titulo: 'ELO Duel',
    sub: 'Higher or Lower',
    desc: '¿Quién tiene más ELO entre estos dos personajes? Adivina seguido y construye tu racha.',
    cadencia: 'Endless · sin límite',
    bestKey: ELO_DUEL_BEST_KEY,
    rarity: 'R',
    endless: true,
  },
]

// `hoverGlow` queda precompuesto para que Tailwind detecte la clase completa
// en extracción estática.
const COLOR_THEMES = {
  rose: {
    border: 'border-rose-500/40',
    bg: 'bg-rose-500/10',
    text: 'text-rose-200',
    glow: 'shadow-[0_0_60px_-15px_rgba(244,63,94,0.55)]',
    hoverGlow: 'hover:shadow-[0_0_60px_-15px_rgba(244,63,94,0.55)]',
    gradient: 'from-rose-500/20 via-fuchsia-500/10 to-purple-500/5',
  },
  amber: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    text: 'text-amber-200',
    glow: 'shadow-[0_0_60px_-15px_rgba(251,191,36,0.55)]',
    hoverGlow: 'hover:shadow-[0_0_60px_-15px_rgba(251,191,36,0.55)]',
    gradient: 'from-amber-500/20 via-orange-500/10 to-rose-500/5',
  },
  emerald: {
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-200',
    glow: 'shadow-[0_0_60px_-15px_rgba(52,211,153,0.55)]',
    hoverGlow: 'hover:shadow-[0_0_60px_-15px_rgba(52,211,153,0.55)]',
    gradient: 'from-emerald-500/20 via-cyan-500/10 to-blue-500/5',
  },
  purple: {
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/10',
    text: 'text-purple-200',
    glow: 'shadow-[0_0_60px_-15px_rgba(168,85,247,0.55)]',
    hoverGlow: 'hover:shadow-[0_0_60px_-15px_rgba(168,85,247,0.55)]',
    gradient: 'from-purple-500/20 via-fuchsia-500/10 to-pink-500/5',
  },
  cyan: {
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-200',
    glow: 'shadow-[0_0_60px_-15px_rgba(34,211,238,0.55)]',
    hoverGlow: 'hover:shadow-[0_0_60px_-15px_rgba(34,211,238,0.55)]',
    gradient: 'from-cyan-500/20 via-sky-500/10 to-indigo-500/5',
  },
}

// Lee el estado de un juego daily desde localStorage para saber si está
// completado HOY y con qué resultado. Sin parsear no se sabe el detalle,
// solo si la fecha coincide.
function leerEstadoJuego(storageKey) {
  if (!storageKey) return { completadoHoy: false }
  const raw = safeStorage.get(storageKey)
  if (!raw) return { completadoHoy: false }
  try {
    const parsed = JSON.parse(raw)
    if (parsed.fecha !== fechaDelDia()) return { completadoHoy: false }
    // Cada juego marca "finalizado" o "rondaIdx >= total" distinto. Lo
    // detectamos por las shapes conocidas.
    const finalizado =
      parsed.finalizado === true ||
      (typeof parsed.rondaIdx === 'number' &&
        Array.isArray(parsed.resultados) &&
        parsed.resultados.length >= parsed.rondaIdx &&
        parsed.rondaIdx >= 3)
    return {
      completadoHoy: finalizado,
      acertado: parsed.acertado === true,
    }
  } catch {
    return { completadoHoy: false }
  }
}

function leerMejorRacha(bestKey) {
  if (!bestKey) return null
  const raw = safeStorage.get(bestKey)
  if (!raw) return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function calcularReinicio() {
  const now = new Date()
  const mañana = new Date(now)
  mañana.setDate(now.getDate() + 1)
  mañana.setHours(0, 0, 0, 0)
  const diffMs = mañana - now
  const h = Math.floor(diffMs / 3_600_000)
  const m = Math.floor((diffMs % 3_600_000) / 60_000)
  return { h, m }
}

function GamesHubPage() {
  useSeo({
    title: 'Anime Daily Trials',
    description:
      'Retos diarios de anime: silueta borrosa, adivina el anime, AniGrid (Wordle), Impostor Trial y ELO Duel. Una ronda al día, una racha que proteger.',
  })

  const [reinicio, setReinicio] = useState(calcularReinicio)
  useEffect(() => {
    const id = setInterval(() => setReinicio(calcularReinicio()), 60_000)
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

  const destacado = GAMES.find((g) => g.destacado) ?? GAMES[0]
  const otros = GAMES.filter((g) => g.to !== destacado.to)

  return (
    <VisualPageShell visual={BRAND_VISUALS.games} className="py-8 sm:py-10" lateralKanji={{left: "遊", right: "戯"}}>
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Daily Trials', path: '/games' },
        ])}
      />
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
                {reinicio.h}h {reinicio.m}m
              </p>
              <p className="text-sm text-fg-muted">hasta que cambie la suerte.</p>
            </div>
          }
        />

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
            value={`${reinicio.h}h ${reinicio.m}m`}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        {/* Nota de producto (2026-05-19): el Omikuji va PRIMERO ahora.
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
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0 opacity-95"
        imageClassName="saturate-110 contrast-105"
      />

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
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0 opacity-95"
        imageClassName="saturate-110 contrast-105"
      />

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
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0 opacity-95"
        imageClassName="saturate-110 contrast-105"
      />
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
