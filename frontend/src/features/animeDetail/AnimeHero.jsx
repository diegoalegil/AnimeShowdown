import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Share2,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { CinematicHero } from '../../components/VisualSystem'

function StatTile({ icon: Icon, label, value, hint, accent }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Icon
          className={`h-3.5 w-3.5 ${accent ? 'text-gold' : 'text-fg-muted'}`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
          {label}
        </span>
      </div>
      <p
        className={`font-mono text-2xl font-extrabold tabular-nums ${accent ? 'text-gold' : 'text-fg-strong'}`}
      >
        {value}
      </p>
      {hint && (
        <p className="line-clamp-1 text-[11px] text-fg-muted">{hint}</p>
      )}
    </div>
  )
}

function AnimeHero({
  anime,
  eloPromedio,
  onShareTop,
  slug,
  top5AnimeHref,
  topElo,
  total,
  totalVotos,
  visual,
}) {
  return (
    <CinematicHero
      visual={visual}
      icon={Sparkles}
      eyebrow="Universo anime"
      title={anime}
      subtitle={`Explora el roster de ${anime}, revisa sus personajes mejor posicionados y descubre quién domina su ranking interno.`}
      actions={
        <>
          <Link
            to={`/votar?anime=${encodeURIComponent(anime)}`}
            className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/50 bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_0_34px_-14px_var(--color-accent)] transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
          >
            <Swords className="h-4 w-4" />
            Votar personajes de {anime}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to={`/animes/${slug}/ranking`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:text-gold"
          >
            <TrendingUp className="h-4 w-4" />
            Ranking de {anime}
          </Link>
          <Link
            to={top5AnimeHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/55 hover:text-gold"
          >
            <Sparkles className="h-4 w-4" />
            Crear Top 5
          </Link>
          <button
            type="button"
            onClick={onShareTop}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:text-gold"
          >
            <Share2 className="h-4 w-4" />
            Compartir top
          </button>
        </>
      }
      aside={
        <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06)] backdrop-blur-md">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
            Dossier del universo
          </p>
          <p className="mt-3 text-sm leading-7 text-fg-muted">
            Portada editorial propia: {visual.mood || 'atmósfera cinematográfica de marca'}.
          </p>
          <p className="mt-4 font-mono text-4xl font-black text-fg-strong">
            {total}
          </p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-fg-muted">
            personajes listos para competir
          </p>
        </div>
      }
    >
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={Users} label="Personajes" value={total} />
        <StatTile
          icon={Trophy}
          label="Top ELO base"
          value={topElo.elo}
          hint={topElo.nombre}
          accent
        />
        <StatTile
          icon={TrendingUp}
          label="ELO base promedio"
          value={eloPromedio}
        />
        <StatTile
          icon={Swords}
          label="Combates base"
          value={totalVotos.toLocaleString('es-ES')}
        />
      </div>
    </CinematicHero>
  )
}

export default AnimeHero
