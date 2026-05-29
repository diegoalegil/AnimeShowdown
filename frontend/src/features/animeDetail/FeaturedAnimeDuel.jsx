import { Link } from 'react-router-dom'
import { Flame, Share2, Swords } from 'lucide-react'
import PersonajeImg from '../../components/PersonajeImg'

function FeaturedDuelCard({ personaje, rank }) {
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
          <p className="font-mono text-sm font-black text-gold">#{rank}</p>
          <h3 className="mt-1 truncate text-2xl font-black text-fg-strong">
            {personaje.nombre}
          </h3>
          <p className="mt-1 text-sm text-fg-muted">{personaje.anime}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniDuelStat label="ELO" value={personaje.elo} accent />
            <MiniDuelStat label="V" value={personaje.wins} />
            <MiniDuelStat label="D" value={personaje.losses} />
          </div>
        </div>
      </div>
    </article>
  )
}

function MiniDuelStat({ label, value, accent }) {
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

function FeaturedAnimeDuel({ anime, a, b, onShare }) {
  const diferencia = Math.abs(a.elo - b.elo)
  const lider = a.elo >= b.elo ? a : b
  return (
    <section className="mb-12 overflow-hidden rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,rgb(159_29_44_/_0.18),rgb(197_161_90_/_0.08),rgb(7_10_18_/_0.82))] p-5 shadow-elev-3 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-gold">
            <Flame className="h-3.5 w-3.5" />
            Duelo destacado
          </p>
          <h2 className="mt-2 text-2xl font-black text-fg-strong">
            El choque fuerte de {anime}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
            {a.nombre} y {b.nombre} son el 1 contra 2 del ranking interno. Es
            el duelo perfecto para pasar de mirar la ficha a mover el ranking.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-bg/55 px-4 py-3 text-sm text-fg-muted">
          <span className="font-bold text-gold">{lider.nombre}</span> llega con{' '}
          <span className="font-mono font-bold text-fg-strong">{diferencia}</span>{' '}
          puntos de ventaja.
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <FeaturedDuelCard personaje={a} rank={1} />
        <div className="flex items-center justify-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-accent/50 bg-accent-soft font-black text-gold shadow-aura">
            VS
          </span>
        </div>
        <FeaturedDuelCard personaje={b} rank={2} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          to={`/duelos/${a.slug}-vs-${b.slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
        >
          <Swords className="h-4 w-4" />
          Comparar duelo
        </Link>
        <Link
          to={`/votar?personaje=${encodeURIComponent(a.slug)}`}
          className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
        >
          <span className="truncate">Retar a {a.nombre}</span>
        </Link>
        <Link
          to={`/votar?personaje=${encodeURIComponent(b.slug)}`}
          className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
        >
          <span className="truncate">Retar a {b.nombre}</span>
        </Link>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-bold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-accent/45 hover:text-gold"
        >
          <Share2 className="h-4 w-4" />
          Compartir duelo
        </button>
      </div>
    </section>
  )
}

export default FeaturedAnimeDuel
