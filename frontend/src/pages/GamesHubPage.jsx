import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, Gamepad2, Grid3X3, Sparkles, TrendingUp, Type } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

/**
 * Hub de modos de juego (Plan v2 §14.1).
 *
 * <p>4 modos client-side sin backend (Daily determinístico por fecha
 * local del cliente):
 * <ul>
 *   <li>Guess the Character — imagen blureada, adivina nombre.</li>
 *   <li>Guess the Anime — imagen clara, adivina anime.</li>
 *   <li>Anidel — Wordle de personajes con pistas.</li>
 *   <li>Detector de Impostor — 5 cartas, encuentra el outlier.</li>
 * </ul>
 *
 * <p>Leaderboards globales (Endless) quedan para cuando haya volumen
 * real — el MVP es Daily compartible estilo Wordle.
 */

const GAMES = [
  {
    to: '/games/guess-character',
    icon: Eye,
    color: 'rose',
    titulo: 'Guess the Character',
    desc: 'Imagen difuminada de un personaje. 5 intentos antes de que aparezca nítido. Acierta antes para más puntos.',
    sub: '1 partida al día',
  },
  {
    to: '/games/guess-anime',
    icon: Type,
    color: 'amber',
    titulo: 'Guess the Anime',
    desc: 'Ves al personaje pero no su anime. Adivínalo con pistas opcionales (nombre del personaje, ELO, anime relacionado).',
    sub: '1 partida al día',
  },
  {
    to: '/games/anidel',
    icon: Grid3X3,
    color: 'emerald',
    titulo: 'Anidel',
    desc: 'Wordle de personajes anime. 6 intentos para acertar el personaje secreto del día. Pistas opcionales (cuestan un intento).',
    sub: '1 partida al día · estilo Wordle',
  },
  {
    to: '/games/impostor',
    icon: Sparkles,
    color: 'purple',
    titulo: 'Detector de Impostor',
    desc: '4 personajes del mismo anime + 1 impostor de otro. Identifícalo antes de que pasen los 15s.',
    sub: '3 rondas al día',
  },
  {
    to: '/higher-or-lower',
    icon: TrendingUp,
    color: 'cyan',
    titulo: 'Higher or Lower',
    desc: '¿Quién tiene más ELO entre estos dos personajes? Adivina seguido y construye tu racha.',
    sub: 'Endless · sin límite',
  },
]

const PILL_COLORS = {
  rose: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  purple: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
  cyan: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
}

function GamesHubPage() {
  useSeo({
    title: 'Anime Games',
    description:
      'Mini-juegos diarios de anime: adivina el personaje, adivina el anime, Anidel (Wordle) y Detector de Impostor. Compartible estilo Wordle.',
  })

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
        ])}
      />
      <div className="mx-auto max-w-5xl">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
            <Gamepad2 className="h-3 w-3" />
            Anime Games
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Daily Hub
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Modos rápidos para entrenar tu nivel de otaku. Un personaje
            elegido a las 00:00 hora local, mismo para todos. Compartes
            resultado en cuadrados estilo Wordle.
          </p>
        </motion.header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {GAMES.map((g) => (
            <Card key={g.to} game={g} />
          ))}
        </div>

        {/* Plan v2 §13.5: Omikuji como bono diario japonés (no juego strict, ritual). */}
        <Link
          to="/omikuji"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-semibold text-accent transition-all hover:-translate-y-0.5 hover:bg-accent/20"
        >
          <span className="font-mono text-base">御籤</span>
          ¿Y tu suerte del día? Tira el omikuji →
        </Link>

        <div className="mt-12 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-fg-muted">
            Cómo funciona
          </h2>
          <ul className="flex flex-col gap-2 text-[13px] text-fg-muted">
            <li>
              · Cada modo tiene <strong>1 partida al día</strong> (3 rondas en el caso
              del Impostor). El personaje se elige determinísticamente por fecha
              local, así todos jugamos el mismo.
            </li>
            <li>
              · Reset a medianoche de tu zona horaria. Vuelve mañana para una nueva
              partida.
            </li>
            <li>
              · El progreso queda en tu navegador (localStorage). Sin cuenta, sin
              backend, sin tracking.
            </li>
            <li>
              · Al final puedes copiar el resultado en formato cuadraditos (🟩🟥) y
              compartirlo donde quieras.
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

function Card({ game }) {
  const Icon = game.icon
  return (
    <Link
      to={game.to}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-lg border ${PILL_COLORS[game.color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          {game.sub}
        </span>
      </div>
      <h3 className="text-lg font-bold text-fg-strong group-hover:text-accent">
        {game.titulo}
      </h3>
      <p className="text-[13px] leading-relaxed text-fg-muted">{game.desc}</p>
    </Link>
  )
}

export default GamesHubPage
