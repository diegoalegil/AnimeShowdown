import { Link } from 'react-router-dom'
import {
  Flame,
  Share2,
  Swords,
} from 'lucide-react'
import PersonajeImg from '../../../components/PersonajeImg'

function RetoRecomendado({ personaje, stats, rival, rivalStats, delta, tipo, onShare }) {
  const lider = stats.elo >= rivalStats.elo ? personaje : rival
  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,rgb(159_29_44_/_0.16),rgb(197_161_90_/_0.08),rgb(7_10_18_/_0.84))] p-5 shadow-elev-3 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-gold">
            <Flame className="h-3.5 w-3.5" />
            Reto recomendado
          </p>
          <h2 className="mt-2 text-2xl font-black text-fg-strong">
            {personaje.nombre} vs {rival.nombre}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
            Rival elegido por cercanía de ELO base
            {tipo === 'mismo anime' ? ` dentro de ${personaje.anime}` : ' entre universos'}.
            Es el duelo más fácil de entender y compartir desde esta ficha.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-bg/55 px-4 py-3 text-sm text-fg-muted">
          <span className="font-bold text-gold">{lider.nombre}</span> llega con{' '}
          <span className="font-mono font-bold text-fg-strong">{delta}</span>{' '}
          puntos de diferencia.
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <RetoCard personaje={personaje} stats={stats} label="Ficha actual" />
        <div className="flex items-center justify-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-accent/50 bg-accent-soft font-black text-gold shadow-aura">
            VS
          </span>
        </div>
        <RetoCard personaje={rival} stats={rivalStats} label="Rival sugerido" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          to={`/duelos/${personaje.slug}-vs-${rival.slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
        >
          <Swords className="h-4 w-4" />
          Comparar duelo
        </Link>
        <Link
          to={`/votar?personaje=${encodeURIComponent(personaje.slug)}`}
          className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
        >
          <span className="truncate">Retar a {personaje.nombre}</span>
        </Link>
        <Link
          to={`/votar?personaje=${encodeURIComponent(rival.slug)}`}
          className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
        >
          <span className="truncate">Retar a {rival.nombre}</span>
        </Link>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-bold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-accent/45 hover:text-gold"
        >
          <Share2 className="h-4 w-4" />
          Compartir reto
        </button>
      </div>
    </section>
  )
}

function RetoCard({ personaje, stats, label }) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-white/10 bg-bg/70">
      <div className="grid gap-4 p-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:p-5">
        <Link
          to={`/personajes/${personaje.slug}`}
          className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface"
        >
          <PersonajeImg
            slug={personaje.slug}
            alt={personaje.nombre}
            className="h-full w-full object-cover object-top transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        </Link>
        <div className="min-w-0 self-center">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gold">
            {label}
          </p>
          <h3 className="mt-1 truncate text-2xl font-black text-fg-strong">
            {personaje.nombre}
          </h3>
          <p className="mt-1 text-sm text-fg-muted">{personaje.anime}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniRetoStat label="ELO" value={stats.elo} accent />
            <MiniRetoStat label="V" value={stats.wins} />
            <MiniRetoStat label="D" value={stats.losses} />
          </div>
        </div>
      </div>
    </article>
  )
}

function MiniRetoStat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-white/10 bg-surface/70 p-2">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-sm font-black ${accent ? 'text-gold' : 'text-fg-strong'}`}>
        {value}
      </p>
    </div>
  )
}

export default RetoRecomendado
