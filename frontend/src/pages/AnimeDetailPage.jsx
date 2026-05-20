import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { getAnimePorSlug } from '../lib/animes'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import PersonajeCard from '../components/PersonajeCard'
import PersonajeImg from '../components/PersonajeImg'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { getAnimeVisual } from '../data/visual-assets'
import NotFoundPage from './NotFoundPage'

/**
 * Ficha de un universo anime — mini-home del anime con stats agregados,
 * personajes destacados, ranking interno y grid completo. Plan v2 §14.
 */
function AnimeDetailPage() {
  const { slug } = useParams()
  const data = getAnimePorSlug(slug)

  useSeo(
    data
      ? {
          title: `${data.anime} · ${data.total} personajes`,
          description: `Roster, ranking ELO interno y stats de ${data.anime} en AnimeShowdown. Top ELO: ${data.topElo.nombre} (${data.topElo.elo}).`,
        }
      : { title: '404 — Anime no encontrado', noindex: true },
  )

  if (!data) return <NotFoundPage />

  const { anime, total, topElo, eloPromedio, porElo, porPopularidad, personajes } = data
  const totalVotos = personajes.reduce((acc, p) => {
    const s = porElo.find((x) => x.slug === p.slug)
    return acc + (s ? s.wins + s.losses : 0)
  }, 0)
  // Personajes destacados: top 6 por popularidad (no por ELO) — la
  // propuesta del usuario habla de "personajes principales", que es más
  // narrativa que competición.
  const destacados = porPopularidad.slice(0, 6)
  const top10 = porElo.slice(0, 10)
  const visual = getAnimeVisual(slug, anime)

  return (
    <VisualPageShell visual={visual} lateralKanji={{left: visual?.kanji ?? "界", right: "界"}}>
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Animes', path: '/animes' },
          { label: anime, path: `/animes/${slug}` },
        ])}
      />
      <div className="mx-auto max-w-6xl">
        <Link
          to="/animes"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a animes
        </Link>

        <CinematicHero
          visual={visual}
          icon={Sparkles}
          eyebrow="Universo anime"
          title={anime}
          subtitle={`Explora el roster de ${anime}, revisa sus personajes mejor posicionados y descubre quién domina su ranking interno.`}
          actions={
            <>
            <Link
              to="/votar"
              className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/50 bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_0_34px_-14px_var(--color-accent)] transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
            >
              <Swords className="h-4 w-4" />
              Votar personajes de {anime}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/ranking"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:text-gold"
            >
              <TrendingUp className="h-4 w-4" />
              Ranking global
            </Link>
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
              label="Top ELO"
              value={topElo.elo}
              hint={topElo.nombre}
              accent
            />
            <StatTile
              icon={TrendingUp}
              label="ELO promedio"
              value={eloPromedio}
            />
            <StatTile
              icon={Swords}
              label="Combates totales"
              value={totalVotos.toLocaleString('es-ES')}
            />
          </div>
        </CinematicHero>

        {/* Personajes destacados — top 6 por popularidad */}
        <section className="mb-12">
          <div className="mb-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              Roster principal
            </span>
            <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
              Personajes destacados
            </h2>
            <p className="text-[13px] text-fg-muted">
              Los más reconocibles del universo {anime}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {destacados.map((p) => (
              <PersonajeCard
                key={p.slug}
                slug={p.slug}
                nombre={p.nombre}
                anime={p.anime}
              />
            ))}
          </div>
        </section>

        {/* Ranking interno del anime */}
        <section className="mb-12">
          <div className="mb-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
              Top 10 · ELO
            </span>
            <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
              Ranking interno de {anime}
            </h2>
            <p className="text-[13px] text-fg-muted">
              Quién domina dentro del universo {anime}. Cada voto en /votar
              puede cambiar este orden.
            </p>
          </div>
          <ol className="flex flex-col gap-2">
            {top10.map((p, i) => (
              <RankingRow
                key={p.slug}
                rank={i + 1}
                slug={p.slug}
                nombre={p.nombre}
                elo={p.elo}
                wins={p.wins}
                losses={p.losses}
              />
            ))}
          </ol>
        </section>

        {/* Grid completo de personajes */}
        {personajes.length > destacados.length && (
          <section>
            <div className="mb-4 flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
                Todos
              </span>
              <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
                Los {total} personajes de {anime}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {personajes.map((p) => (
                <PersonajeCard
                  key={p.slug}
                  slug={p.slug}
                  nombre={p.nombre}
                  anime={p.anime}
                />
              ))}
            </div>
          </section>
        )}

        <p className="mt-12 text-center text-[13px] text-fg-muted">
          Tu personaje favorito no sube solo.{' '}
          <Link to="/votar" className="text-accent hover:underline">
            Entra a votar
          </Link>{' '}
          y cambia el ranking de {anime}.
        </p>
      </div>
    </VisualPageShell>
  )
}

function StatTile({ icon: Icon, label, value, hint, accent }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Icon
          className={`h-3.5 w-3.5 ${accent ? 'text-yellow-400' : 'text-fg-muted'}`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
          {label}
        </span>
      </div>
      <p
        className={`font-mono text-2xl font-extrabold tabular-nums ${accent ? 'text-accent' : 'text-fg-strong'}`}
      >
        {value}
      </p>
      {hint && (
        <p className="line-clamp-1 text-[11px] text-fg-muted">{hint}</p>
      )}
    </div>
  )
}

function RankingRow({ rank, slug, nombre, elo, wins, losses }) {
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null
  const tone =
    rank === 1
      ? 'border-yellow-400/50 bg-yellow-500/5'
      : rank <= 3
        ? 'border-amber-400/40 bg-amber-500/5'
        : 'border-border bg-surface'
  return (
    <li>
      <Link
        to={`/personajes/${slug}`}
        className={`group flex items-center gap-4 rounded-lg border px-3 py-2.5 transition-all hover:-translate-x-1 hover:border-accent/40 sm:px-5 ${tone}`}
      >
        <span
          className={`w-8 shrink-0 font-mono text-base font-extrabold tabular-nums ${
            rank === 1
              ? 'text-yellow-300'
              : rank <= 3
                ? 'text-amber-300'
                : 'text-fg-muted'
          }`}
        >
          #{rank}
        </span>
        <PersonajeImg
          slug={slug}
          alt=""
          loading="lazy"
          className="h-12 w-9 shrink-0 rounded-md object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-accent">
            {nombre}
          </p>
          {winRate != null && (
            <p className="text-[11px] text-fg-muted">
              {wins}V · {losses}D ·{' '}
              <span className="text-emerald-300/80">{winRate}% WR</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-accent">{elo}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            ELO
          </p>
        </div>
      </Link>
    </li>
  )
}

export default AnimeDetailPage
