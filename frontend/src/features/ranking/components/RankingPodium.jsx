import { Link } from 'react-router-dom'
import {
  Crown,
  Medal,
} from 'lucide-react'
import PersonajeImg from '../../../components/PersonajeImg'
import EloSparkline from './EloSparkline'

function RankingPodium({ top3, historyBySlug = {} }) {
  const [primero, segundo, tercero] = top3
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6">
      <PodioCard
        personaje={primero}
        rank={1}
        highlighted
        history={historyBySlug[primero.slug]}
        className="col-span-2 sm:order-2 sm:col-span-1"
      />
      <PodioCard
        personaje={segundo}
        rank={2}
        history={historyBySlug[segundo.slug]}
        className="sm:order-1"
      />
      <PodioCard
        personaje={tercero}
        rank={3}
        history={historyBySlug[tercero.slug]}
        className="sm:order-3"
      />
    </div>
  )
}

function PodioCard({ personaje, rank, highlighted, history, className = '' }) {
  if (!personaje?.slug) return null
  const tone =
    rank === 1
      ? {
          border: 'border-yellow-400/70',
          bg: 'bg-gradient-to-b from-yellow-500/15 via-amber-500/5 to-transparent',
          text: 'text-yellow-300',
          glow: 'shadow-[0_0_80px_-15px_rgba(251,191,36,0.6)]',
          icon: Crown,
          label: 'Campeón actual',
        }
      : rank === 2
        ? {
            border: 'border-zinc-300/50',
            bg: 'bg-gradient-to-b from-zinc-400/10 via-zinc-500/5 to-transparent',
            text: 'text-zinc-200',
            glow: 'shadow-[0_0_40px_-15px_rgba(244,244,245,0.4)]',
            icon: Medal,
            label: '2º puesto',
          }
        : {
            border: 'border-orange-400/50',
            bg: 'bg-gradient-to-b from-orange-500/10 via-amber-700/5 to-transparent',
            text: 'text-orange-300',
            glow: 'shadow-[0_0_40px_-15px_rgba(251,146,60,0.4)]',
            icon: Medal,
            label: '3er puesto',
          }
  const Icon = tone.icon
  const linkLayout = highlighted
    ? 'grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 text-left sm:flex sm:flex-col sm:items-center sm:gap-2 sm:p-3 sm:pt-6 sm:text-center'
    : 'flex flex-col items-center gap-2 p-3 pt-4 text-center'

  return (
    <Link
      to={`/personajes/${personaje.slug}`}
      className={`group relative overflow-hidden rounded-2xl border-2 transition-all motion-safe:hover:-translate-y-1 ${linkLayout} ${tone.border} ${tone.bg} ${highlighted ? tone.glow : ''} ${className}`}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em] ${tone.border} ${tone.text} ${highlighted ? 'col-span-2 justify-self-start sm:justify-self-auto' : ''}`}
      >
        <Icon className="h-3 w-3" />
        #{rank}
        {highlighted && ` · ${tone.label}`}
      </span>
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-xl border ${tone.border} bg-surface ${
          highlighted
            ? 'max-w-[8.5rem] sm:mx-auto sm:max-w-none'
            : 'mx-auto max-w-[8rem] opacity-95 sm:max-w-none'
        }`}
      >
        <PersonajeImg
          slug={personaje.slug}
          src={personaje.imagenUrl}
          nombre={personaje.nombre}
          colorDominante={personaje.imagenColorDominante}
          alt={personaje.nombre}
          loading="eager"
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div
        className={`flex min-w-0 flex-col gap-0.5 ${
          highlighted ? 'items-start sm:items-center' : 'items-center'
        }`}
      >
        <h3
          className={`line-clamp-1 font-bold text-fg-strong group-hover:text-gold ${
            highlighted ? 'text-base sm:text-lg' : 'text-sm'
          }`}
        >
          {personaje.nombre}
        </h3>
        <p className="line-clamp-1 text-[11px] text-fg-muted">
          {personaje.anime}
        </p>
        <p
          className={`mt-1 font-mono font-extrabold tabular-nums ${tone.text} ${
            highlighted ? 'text-2xl' : 'text-lg'
          }`}
        >
          {personaje.elo}
          <span className="ml-1 text-[10px] uppercase tracking-wider opacity-70">
            ELO
          </span>
        </p>
        <EloSparkline points={history} className="mt-1" />
      </div>
    </Link>
  )
}

export default RankingPodium
