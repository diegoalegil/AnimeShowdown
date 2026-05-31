import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Flame,
  Medal,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import PersonajeImg from '../../components/PersonajeImg'
import { useRankingMovimientos, useRankingSegmentado } from '../../hooks/useRanking'
import { usePersonajesSimilares } from '../../hooks/usePersonajesSimilares'
import { useTorneos } from '../../lib/torneosQueries'
import {
  buildAnimeTierList,
  buildCrossAnimeRecommendations,
  filterAnimeMovers,
  getClosestEloDuel,
  getHallOfFame,
  getMonthlyHero,
  getRevelation,
} from './anime-hub-data'

function HubCard({ eyebrow, title, icon: Icon, children, action }) {
  return (
    <section className="as-panel flex min-h-full flex-col rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-gold">
            <Icon className="h-3.5 w-3.5" />
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-black text-fg-strong">{title}</h2>
        </div>
        {action}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  )
}

function EmptyMicro({ children }) {
  return (
    <div className="flex min-h-28 items-center rounded-lg border border-dashed border-border bg-surface-alt/40 p-4 text-sm leading-6 text-fg-muted">
      {children}
    </div>
  )
}

function MiniPersonajeRow({ personaje, meta, rank, tone = 'default' }) {
  if (!personaje?.slug) return null
  const rankClass = tone === 'gold' ? 'text-gold' : 'text-fg-muted'
  return (
    <Link
      to={`/personajes/${personaje.slug}`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-all hover:-translate-x-1 hover:border-accent/40"
    >
      {rank && (
        <span className={`w-7 shrink-0 font-mono text-sm font-black ${rankClass}`}>
          #{rank}
        </span>
      )}
      <PersonajeImg
        slug={personaje.slug}
        src={personaje.imagenUrl}
        alt={personaje.nombre}
        loading="lazy"
        className="h-12 w-9 shrink-0 rounded-lg object-cover object-top"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
          {personaje.nombre}
        </p>
        {meta && <p className="truncate text-[12px] text-fg-muted">{meta}</p>}
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
    </Link>
  )
}

function RealRankingCard({ anime, ranking, isLoading, slug }) {
  const top = Array.isArray(ranking) ? ranking.slice(0, 5) : []
  return (
    <HubCard
      eyebrow="Ranking vivo"
      title={`Top por votos de ${anime}`}
      icon={TrendingUp}
      action={
        <Link
          to={`/animes/${slug}/ranking`}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[12px] font-bold text-fg-strong transition-colors hover:border-accent/45 hover:text-gold"
        >
          Ver ranking
        </Link>
      }
    >
      {isLoading ? (
        <EmptyMicro>Cargando votos del universo...</EmptyMicro>
      ) : top.length === 0 ? (
        <EmptyMicro>
          Este universo todavía no tiene votos suficientes para publicar un top
          competitivo.
        </EmptyMicro>
      ) : (
        <ol className="flex flex-col gap-2">
          {top.map((item, index) => (
            <li key={item.personaje.slug}>
              <MiniPersonajeRow
                personaje={item.personaje}
                rank={index + 1}
                tone={index === 0 ? 'gold' : 'default'}
                meta={`${item.votos} votos reales`}
              />
            </li>
          ))}
        </ol>
      )}
    </HubCard>
  )
}

function MomentumCard({ anime, monthlyHero, movers, revelation }) {
  return (
    <HubCard eyebrow="Pulso" title="Racha del universo" icon={Flame}>
      <div className="grid gap-3">
        {monthlyHero ? (
          <MiniPersonajeRow
            personaje={monthlyHero.personaje}
            tone="gold"
            meta={`${monthlyHero.votos} votos en los últimos 30 días`}
          />
        ) : (
          <EmptyMicro>
            Aún no hay un personaje destacado este mes para {anime}.
          </EmptyMicro>
        )}

        {revelation && (
          <div className="rounded-lg border border-success/25 bg-success/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-success">
              Revelación
            </p>
            <p className="mt-1 text-sm font-bold text-fg-strong">
              {revelation.nombre}
            </p>
            <p className="text-[12px] text-fg-muted">
              {revelation.esNuevo
                ? 'Nuevo en el ranking reciente'
                : `Sube ${revelation.delta} puestos`}
            </p>
          </div>
        )}

        {movers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {movers.slice(0, 4).map((item) => (
              <Link
                key={item.slug}
                to={`/personajes/${item.slug}`}
                className="rounded-lg border border-border bg-bg/55 px-3 py-2 text-[12px] font-bold text-fg-strong transition-colors hover:border-accent/45 hover:text-gold"
              >
                {item.nombre}
                <span className="ml-2 font-mono text-gold">
                  {item.esNuevo ? 'NEW' : item.delta > 0 ? `+${item.delta}` : item.delta}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </HubCard>
  )
}

function HallOfFameCard({ hall }) {
  return (
    <HubCard eyebrow="Hall of Fame" title="Copas conquistadas" icon={Trophy}>
      {hall.length === 0 ? (
        <EmptyMicro>
          Este universo todavía no tiene campeones en torneos finalizados.
        </EmptyMicro>
      ) : (
        <div className="grid gap-3">
          {hall.map(({ torneo, ganador }) => (
            <Link
              key={torneo.slug}
              to={`/torneos/${torneo.slug}`}
              className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-gold/45"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold">
                <Medal className="h-4 w-4" />
              </span>
              <PersonajeImg
                slug={ganador.slug}
                alt={ganador.nombre}
                loading="lazy"
                className="h-12 w-9 rounded-lg object-cover object-top"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-fg-strong group-hover:text-gold">
                  {torneo.nombre}
                </p>
                <p className="truncate text-[12px] text-fg-muted">
                  Campeón: {ganador.nombre}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </HubCard>
  )
}

function RecommendationsCard({ source, recomendaciones }) {
  return (
    <HubCard eyebrow="También votan" title="Rutas desde este fandom" icon={Sparkles}>
      {!source?.slug || recomendaciones.length === 0 ? (
        <EmptyMicro>
          Las recomendaciones aparecerán cuando haya más co-votos conectados.
        </EmptyMicro>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {recomendaciones.map((item) => (
            <MiniPersonajeRow
              key={item.slug}
              personaje={item}
              meta={`${item.anime} · ${Math.round((item.score ?? 0) * 100)}% afinidad`}
            />
          ))}
        </div>
      )}
    </HubCard>
  )
}

function TierListCard({ tierList }) {
  return (
    <HubCard eyebrow="Tier-list ELO" title="Mapa competitivo" icon={Swords}>
      <div className="flex flex-col gap-2">
        {tierList.map((tier) => (
          <div
            key={tier.id}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-surface"
          >
            <div className="flex items-center justify-center bg-accent-soft font-mono text-lg font-black text-gold">
              {tier.label}
            </div>
            <div className="flex flex-wrap gap-2 p-2">
              {tier.personajes.slice(0, 8).map((personaje) => (
                <Link
                  key={personaje.slug}
                  to={`/personajes/${personaje.slug}`}
                  className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-white/10 bg-bg/55 px-2 py-1 text-[12px] font-bold text-fg-strong hover:text-gold"
                >
                  <PersonajeImg
                    slug={personaje.slug}
                    alt={personaje.nombre}
                    loading="lazy"
                    className="h-7 w-5 rounded object-cover object-top"
                  />
                  <span className="truncate">{personaje.nombre}</span>
                </Link>
              ))}
              {tier.personajes.length > 8 && (
                <span className="rounded-md border border-border bg-bg/55 px-2 py-1 text-[12px] text-fg-muted">
                  +{tier.personajes.length - 8}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </HubCard>
  )
}

function CloseDuelCard({ duel }) {
  return (
    <HubCard eyebrow="Controversia" title="Duelo más reñido" icon={Swords}>
      {!duel ? (
        <EmptyMicro>Faltan rivales para medir un duelo cerrado.</EmptyMicro>
      ) : (
        <div className="grid gap-3">
          <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <MiniPersonajeRow personaje={duel.a} meta={`${duel.a.elo} ELO`} tone="gold" />
            <span className="justify-self-center rounded-full border border-accent/45 bg-accent-soft px-3 py-2 text-[12px] font-black text-gold">
              {duel.diff} pts
            </span>
            <MiniPersonajeRow personaje={duel.b} meta={`${duel.b.elo} ELO`} tone="gold" />
          </div>
          <Link
            to={`/duelos/${duel.a.slug}-vs-${duel.b.slug}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
          >
            <Swords className="h-4 w-4" />
            Comparar duelo
          </Link>
        </div>
      )}
    </HubCard>
  )
}

function AnimeHubModules({ anime, personajes, porElo, slug, topElo }) {
  const { data: rankingAnime, isLoading: rankingAnimeLoading } = useRankingSegmentado({
    anime,
    limit: 8,
    enabled: Boolean(anime),
  })
  const { data: rankingMes } = useRankingSegmentado({
    periodo: 'mes',
    limit: 200,
    enabled: Boolean(anime),
  })
  const { data: movimientos } = useRankingMovimientos({ limit: 100, dias: 7 })
  const { data: torneos } = useTorneos()
  const { data: similares } = usePersonajesSimilares(topElo?.slug, { limit: 16 })

  const personajesBySlug = useMemo(
    () => new Map((personajes ?? []).map((p) => [p.slug, p])),
    [personajes],
  )
  const tierList = useMemo(() => buildAnimeTierList(porElo), [porElo])
  const monthlyHero = useMemo(
    () => getMonthlyHero(rankingMes ?? [], anime),
    [rankingMes, anime],
  )
  const animeMovers = useMemo(
    () => filterAnimeMovers(movimientos ?? [], anime, 5),
    [movimientos, anime],
  )
  const revelation = useMemo(() => getRevelation(animeMovers), [animeMovers])
  const hall = useMemo(
    () => getHallOfFame(torneos ?? [], personajesBySlug, anime, 4),
    [torneos, personajesBySlug, anime],
  )
  const recomendaciones = useMemo(
    () => buildCrossAnimeRecommendations(similares ?? [], anime, 6),
    [similares, anime],
  )
  const closeDuel = useMemo(() => getClosestEloDuel(porElo), [porElo])

  return (
    <div className="mb-12">
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
          Hub de {anime}
        </p>
        <h2 className="text-2xl font-black text-fg-strong">
          Lo que se mueve en este universo
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RealRankingCard
          anime={anime}
          ranking={rankingAnime}
          isLoading={rankingAnimeLoading}
          slug={slug}
        />
        <MomentumCard
          anime={anime}
          monthlyHero={monthlyHero}
          movers={animeMovers}
          revelation={revelation}
        />
        <HallOfFameCard hall={hall} />
        <RecommendationsCard source={topElo} recomendaciones={recomendaciones} />
        <TierListCard tierList={tierList} />
        <CloseDuelCard duel={closeDuel} />
      </div>
    </div>
  )
}

export default AnimeHubModules
