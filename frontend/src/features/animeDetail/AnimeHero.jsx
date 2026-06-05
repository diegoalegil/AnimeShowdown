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
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Icon
          className={`h-3.5 w-3.5 ${accent ? 'text-gold' : 'text-fg-muted'}`}
        />
        <span className="text-[10px] font-semibold text-fg-muted">
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
  const identity = visual?.identity
  const dossierCopy = identity?.copy || visual.mood || 'Atmosfera cinematografica de marca.'
  const motifs = identity?.motifs?.slice(0, 3) ?? []

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
            className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/50 bg-accent px-4 py-2 text-sm font-semibold text-white shadow-aura transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
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
        <div className="rounded-2xl border border-white/10 bg-bg/60 p-5 inset-shadow-hairline backdrop-blur-md">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              lang="ja"
              className="font-mono text-4xl font-black leading-none text-gold"
              style={{ textShadow: 'var(--text-shadow-glow-sm)' }}
            >
              {identity?.kanji ?? visual.kanji}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-gold">
                {identity?.emblem ?? 'Dossier del universo'}
              </p>
              <p className="mt-2 text-sm leading-7 text-fg-muted">
                {dossierCopy}
              </p>
            </div>
          </div>
          {motifs.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {motifs.map((motif) => (
                <span
                  key={motif}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-fg-muted"
                >
                  {motif}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-[auto_1fr] items-end gap-x-3">
            <p className="font-mono text-4xl font-black text-fg-strong">
              {total}
            </p>
            <p className="pb-1 text-[11px] text-fg-muted">
              personajes listos para competir
            </p>
          </div>
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
