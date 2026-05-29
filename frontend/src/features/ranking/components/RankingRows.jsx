import { Link } from 'react-router-dom'
import {
  Crown,
  Swords,
} from 'lucide-react'
import PersonajeCutImg from '../../../components/PersonajeCutImg'
import PersonajeImg from '../../../components/PersonajeImg'
import EloSparkline from './EloSparkline'

export function RankRowElo({
  rank,
  slug,
  nombre,
  anime,
  elo,
  history,
  imagenUrl,
  imagenColorDominante,
}) {
  if (!slug) return null
  // Solo ELO base (estimado). Las W/L sintéticas no se muestran: el "X% WR"
  // que salía aquí no venía de votos reales y leía como dato competitivo.
  const esTop10 = rank <= 10
  const rowTone = esTop10
    ? 'border-medal-gold/30 bg-gradient-to-r from-medal-gold/5 to-surface'
    : 'border-border bg-surface'
  return (
    <li>
      <div
        className={`group flex items-center gap-2 rounded-lg border px-3 py-3 transition-all hover:-translate-x-1 hover:border-accent/40 hover:bg-surface-alt sm:gap-3 sm:px-5 ${rowTone}`}
      >
        <Link
          to={`/personajes/${slug}`}
          aria-label={`Rank #${rank} — ${nombre} de ${anime}, ELO base ${elo}`}
          title={`${nombre} de ${anime} · ELO base ${elo}`}
          className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5"
        >
          <RankBadge rank={rank} />
          <PersonajeImg
            slug={slug}
            src={imagenUrl}
            nombre={nombre}
            colorDominante={imagenColorDominante}
            alt={nombre}
            loading="lazy"
            className="h-14 w-10 shrink-0 rounded-md object-cover object-top sm:hidden"
          />
          <PersonajeCutImg
            slug={slug}
            alt={nombre}
            loading="lazy"
            sizes="56px"
            className="hidden h-14 w-14 shrink-0 rounded-lg border border-white/10 sm:block"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
                {nombre}
              </p>
              {esTop10 && (
                <span className="hidden shrink-0 rounded border border-medal-gold/40 bg-medal-gold/10 px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-medal-gold sm:inline">
                  Top 10
                </span>
              )}
            </div>
            <p className="truncate text-[12px] text-fg-muted">{anime}</p>
            {esTop10 && <EloSparkline points={history} className="mt-1" />}
          </div>
          <div
            className="text-right"
            title="ELO base estimado por popularidad. El ranking real por votos está en las pestañas Histórico y Este mes."
          >
            <p className="font-mono text-base font-bold text-gold">
              {elo}
              <span className="ml-0.5 text-[10px] font-bold text-gold/80">·b</span>
            </p>
            <p className="text-[10px] uppercase tracking-wider text-fg-muted">
              ELO base
            </p>
          </div>
        </Link>
        <ChallengeLink slug={slug} nombre={nombre} />
      </div>
    </li>
  )
}

export function RankRowVotos({ rank, personaje, votos, movimiento = null }) {
  if (!personaje?.slug) return null
  return (
    <li>
      <div className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 transition-all hover:-translate-x-1 hover:border-accent/40 hover:bg-surface-alt sm:gap-3 sm:px-5">
        <Link
          to={`/personajes/${personaje.slug}`}
          aria-label={`Rank #${rank} — ${personaje.nombre} de ${personaje.anime}, ${votos} votos`}
          title={`${personaje.nombre} de ${personaje.anime}`}
          className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5"
        >
          <RankBadge rank={rank} />
          <PersonajeImg
            slug={personaje.slug}
            src={personaje.imagenUrl}
            nombre={personaje.nombre}
            colorDominante={personaje.imagenColorDominante}
            alt={personaje.nombre}
            loading="lazy"
            className="h-14 w-10 shrink-0 rounded-md object-cover object-top sm:hidden"
          />
          <PersonajeCutImg
            slug={personaje.slug}
            alt={personaje.nombre}
            loading="lazy"
            sizes="56px"
            className="hidden h-14 w-14 shrink-0 rounded-lg border border-white/10 sm:block"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
                {personaje.nombre}
              </p>
              {movimiento && <MovimientoBadge movimiento={movimiento} />}
            </div>
            <p className="truncate text-[12px] text-fg-muted">
              {personaje.anime}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-base font-bold text-gold">{votos}</p>
            <p className="text-[10px] uppercase tracking-wider text-fg-muted">
              votos
            </p>
          </div>
        </Link>
        <ChallengeLink slug={personaje.slug} nombre={personaje.nombre} />
      </div>
    </li>
  )
}

function ChallengeLink({ slug, nombre }) {
  return (
    <Link
      to={`/votar?personaje=${encodeURIComponent(slug)}`}
      aria-label={`Retar a ${nombre} en un duelo`}
      title={`Retar a ${nombre}`}
      className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 text-[12px] font-black text-gold transition-colors hover:bg-accent/20"
    >
      <Swords className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Retar</span>
    </Link>
  )
}

function RankBadge({ rank }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold ${
        rank === 1
          ? 'bg-medal-gold/15 text-medal-gold'
          : rank === 2
            ? 'bg-medal-silver/15 text-medal-silver'
            : rank === 3
              ? 'bg-medal-bronze/15 text-medal-bronze'
              : 'bg-surface-alt text-fg-muted'
      }`}
    >
      {rank === 1 ? <Crown className="h-5 w-5" /> : rank}
    </span>
  )
}

function MovimientoBadge({ movimiento }) {
  if (movimiento.esNuevo) {
    return (
      <span className="inline-flex shrink-0 items-center rounded border border-accent/40 bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-gold">
        Nuevo
      </span>
    )
  }
  const delta = movimiento.delta
  if (delta == null || delta === 0) {
    return (
      <span
        className="inline-flex shrink-0 items-center font-mono text-[11px] font-bold text-fg-muted"
        title="Mantiene posición vs hace 7 días"
      >
        =
      </span>
    )
  }
  if (delta > 0) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-0.5 rounded border border-success/30 bg-success/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-success"
        title={`Subió ${delta} posiciones vs hace 7 días`}
      >
        ↑{delta}
      </span>
    )
  }
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded border border-danger/30 bg-danger/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-danger"
      title={`Bajó ${Math.abs(delta)} posiciones vs hace 7 días`}
    >
      ↓{Math.abs(delta)}
    </span>
  )
}
