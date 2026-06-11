import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Share2,
  Sparkles,
  Swords,
  TrendingUp,
} from 'lucide-react'
import { brandImage } from '../../lib/brand-assets'
import AnimeCinematicHero from './AnimeCinematicHero'

/**
 * Hero del detalle de anime: compone AnimeCinematicHero (scene del banco a
 * ~55vh + kanji marca de agua + medallón del symbol + stats en mono) con la
 * funcionalidad de producto que ya existía — CTAs de votar/ranking/top5/
 * compartir y el dossier de identidad como columna derecha.
 */
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
  // El symbol comparte slug con la scene en el banco (verificado: los 105
  // tríos están completos). Si el anime no tiene arte, sin medallón.
  const symbol = brandImage(`${visual?.slug ?? slug}-symbol-01`)

  return (
    <AnimeCinematicHero
      sceneSrc={visual?.image || visual?.fallbackImage}
      sceneSrcSet={visual?.imageWebpSrcset}
      symbolSrc={symbol?.src ?? null}
      slug={slug}
      nombre={anime}
      kanji={identity?.kanji ?? visual?.kanji ?? '戦'}
      stats={[
        { label: 'personajes', value: total },
        { label: 'top ELO base', value: topElo.elo, gold: true, hint: topElo.nombre },
        { label: 'ELO base promedio', value: eloPromedio },
        { label: 'combates base', value: totalVotos },
      ]}
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
        </div>
      }
    />
  )
}

export default AnimeHero
