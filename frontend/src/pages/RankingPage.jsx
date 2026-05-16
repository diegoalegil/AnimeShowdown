import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, Clock, Trophy, Tv, Vote } from 'lucide-react'
import {
  personajes,
  imagenPersonaje,
  getStatsPersonaje,
} from '../data/personajes'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import {
  useAnimesConVotos,
  useRankingSegmentado,
} from '../hooks/useRanking'

/**
 * RankingPage con tabs segmentadas (Plan v2 §4.6).
 *
 * Tabs:
 *   - ELO local — el ELO del catálogo, sin fetch (siempre disponible).
 *   - All-time — top votos absoluto desde el backend.
 *   - Mes — últimos 30 días.
 *   - Por anime — dropdown con animes que tienen al menos 1 voto.
 *
 * Atributos por género/época del plan §4.6 quedan pendientes hasta el
 * bloque 15 (atributos extendidos del catálogo).
 */

const rankedElo = [...personajes]
  .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
  .sort((a, b) => b.elo - a.elo)

const TABS = [
  { id: 'elo', label: 'ELO local', icon: Trophy },
  { id: 'all', label: 'All-time', icon: Vote },
  { id: 'mes', label: 'Este mes', icon: Calendar },
  { id: 'anime', label: 'Por anime', icon: Tv },
]

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

function RankingPage() {
  useSeo({
    title: 'Ranking ELO',
    description: `Top ${personajes.length} personajes de anime ordenados por ELO local, votos all-time y por mes. Filtra por anime para ver quién domina cada universo.`,
  })
  const [tab, setTab] = useState('elo')

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Ranking', path: '/ranking' },
        ])}
      />
      <div className="mx-auto max-w-4xl">
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            Ranking
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            ¿Quién manda?
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Cuatro ventanas sobre la misma pregunta. El{' '}
            <strong>ELO local</strong> calcula la fuerza de cada personaje
            desde el catálogo; las demás tabs leen los votos reales del
            backend en distintos cortes.
          </p>
        </motion.header>

        <Tabs activo={tab} onChange={setTab} />

        <div className="mt-6">
          {tab === 'elo' && <ListaEloLocal />}
          {tab === 'all' && <ListaBackend periodo="all" />}
          {tab === 'mes' && <ListaBackend periodo="mes" />}
          {tab === 'anime' && <PorAnime />}
        </div>

        <HubLinks />

        <TablaExtraible />
      </div>
    </section>
  )
}

/**
 * Tabla HTML semántica con el top 10 ELO local (Plan v2 §6.2). Sirve
 * dos públicos:
 *   - Crawlers de IA (GPTBot, ClaudeBot, PerplexityBot) que prefieren
 *     extraer datos tabulares estructurados antes que listas decoradas.
 *   - Usuarios que quieren copy/paste de los datos para un Sheets/post.
 *
 * Usa table/thead/tbody/th-scope estándar — sin estilos exóticos para
 * que los parsers de tablas (Common Crawl, Bing tables) la pillen.
 */
function TablaExtraible() {
  const top10 = rankedElo.slice(0, 10)
  return (
    <section
      aria-labelledby="top10-elo-heading"
      className="mt-12 rounded-xl border border-border bg-surface p-6"
    >
      <h2
        id="top10-elo-heading"
        className="mb-2 text-sm font-semibold uppercase tracking-wider text-fg-muted"
      >
        Top 10 ELO — datos extraíbles
      </h2>
      <p className="mb-4 text-[12px] text-fg-muted">
        Tabla en formato estándar para copia rápida o referencia en posts.
        Datos del ELO local calculado desde el catálogo (actualizado a fecha de
        deploy).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-fg-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Rank
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Personaje
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Anime
              </th>
              <th
                scope="col"
                className="py-2 pr-3 text-right font-mono font-semibold tabular-nums"
              >
                ELO
              </th>
              <th
                scope="col"
                className="hidden py-2 pr-3 text-right font-semibold sm:table-cell"
              >
                W/L
              </th>
            </tr>
          </thead>
          <tbody>
            {top10.map((p, i) => (
              <tr
                key={p.slug}
                className="border-b border-border/60 last:border-0"
              >
                <th
                  scope="row"
                  className="py-2 pr-3 font-mono font-semibold text-fg-strong tabular-nums"
                >
                  {i + 1}
                </th>
                <td className="py-2 pr-3 text-fg-strong">
                  <Link
                    to={`/personajes/${p.slug}`}
                    className="hover:text-accent hover:underline"
                  >
                    {p.nombre}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-fg-muted">{p.anime}</td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums text-accent">
                  {p.elo}
                </td>
                <td className="hidden py-2 pr-3 text-right font-mono text-fg-muted tabular-nums sm:table-cell">
                  {p.wins}/{p.losses}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * Sección hub al final de /ranking con links descriptivos (Plan v2 §5.6).
 * Ayuda al crawler a seguir hilos de contenido relacionado y al usuario
 * a descubrir secciones complementarias sin volver al menú superior.
 */
function HubLinks() {
  return (
    <div className="mt-12 rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">
        Sigue explorando
      </h2>
      <p className="text-[13px] leading-relaxed text-fg-muted">
        Para entender mejor el ranking puedes{' '}
        <Link to="/faq" className="text-accent hover:underline">
          leer cómo funciona el sistema ELO en AnimeShowdown
        </Link>
        , o explorar el{' '}
        <Link to="/personajes" className="text-accent hover:underline">
          catálogo completo de {personajes.length} personajes
        </Link>{' '}
        con filtros por anime. Si quieres ponerle números a tus discusiones,{' '}
        <Link to="/votar" className="text-accent hover:underline">
          vota en matches casuales
        </Link>{' '}
        o entra en{' '}
        <Link to="/torneos" className="text-accent hover:underline">
          uno de los torneos activos
        </Link>{' '}
        — cada voto cuenta hacia los ELO que ves aquí arriba.
      </p>
    </div>
  )
}

function Tabs({ activo, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            activo === id
              ? 'bg-accent text-bg'
              : 'text-fg-muted hover:bg-surface-alt hover:text-fg-strong'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

function ListaEloLocal() {
  return (
    <ol className="flex flex-col gap-2">
      {rankedElo.slice(0, 100).map((p, i) => (
        <RankRowElo key={p.slug} rank={i + 1} {...p} />
      ))}
    </ol>
  )
}

function ListaBackend({ periodo }) {
  const { data, isLoading, isError } = useRankingSegmentado({
    periodo,
    limit: 100,
  })
  return (
    <ListaVotosCommon items={data} isLoading={isLoading} isError={isError} />
  )
}

function PorAnime() {
  const { data: animes, isLoading: cargandoAnimes } = useAnimesConVotos()
  const [anime, setAnime] = useState('')
  const { data, isLoading, isError } = useRankingSegmentado({
    anime,
    limit: 50,
    enabled: Boolean(anime),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
        <label
          htmlFor="anime-select"
          className="text-[12px] font-semibold text-fg-muted"
        >
          Anime:
        </label>
        <select
          id="anime-select"
          value={anime}
          onChange={(e) => setAnime(e.target.value)}
          disabled={cargandoAnimes}
          className="flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg-strong focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="">— Elige un anime —</option>
          {(animes ?? []).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {!anime ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-alt/40 p-6 text-center text-[12px] text-fg-muted">
          Selecciona un anime para ver el ranking de sus personajes.
        </p>
      ) : (
        <ListaVotosCommon
          items={data}
          isLoading={isLoading}
          isError={isError}
        />
      )}
    </div>
  )
}

function ListaVotosCommon({ items, isLoading, isError }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }
  if (isError) {
    return (
      <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-[12px] text-rose-300">
        No se pudo cargar el ranking. Reintenta en unos segundos.
      </p>
    )
  }
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface-alt/40 p-8 text-fg-muted">
        <Clock className="h-6 w-6" />
        <p className="text-[12px]">
          Aún no hay votos en esta ventana. Vuelve cuando haya tráfico real.
        </p>
      </div>
    )
  }
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <RankRowVotos
          key={item.personaje.slug}
          rank={i + 1}
          personaje={item.personaje}
          votos={item.votos}
        />
      ))}
    </ol>
  )
}

function RankRowElo({ rank, slug, nombre, anime, elo, wins, losses }) {
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Link
        to={`/personajes/${slug}`}
        aria-label={`Rank #${rank} — ${nombre} de ${anime}, ELO ${elo}, ${winRate}% win rate`}
        title={`${nombre} de ${anime} · ELO ${elo}`}
        className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 transition-all hover:border-accent/40 hover:bg-surface-alt sm:gap-5 sm:px-5"
      >
        <RankBadge rank={rank} />
        <img
          src={imagenPersonaje(slug)}
          alt=""
          loading="lazy"
          className="h-14 w-10 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-accent">
            {nombre}
          </p>
          <p className="truncate text-[12px] text-fg-muted">{anime}</p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-[12px] text-fg-muted">
            {wins}V · {losses}D
          </p>
          <p className="text-[12px] text-fg-muted">{winRate}% win rate</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-bold text-accent">{elo}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            ELO
          </p>
        </div>
      </Link>
    </motion.li>
  )
}

function RankRowVotos({ rank, personaje, votos }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Link
        to={`/personajes/${personaje.slug}`}
        aria-label={`Rank #${rank} — ${personaje.nombre} de ${personaje.anime}, ${votos} votos`}
        title={`${personaje.nombre} de ${personaje.anime}`}
        className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 transition-all hover:border-accent/40 hover:bg-surface-alt sm:gap-5 sm:px-5"
      >
        <RankBadge rank={rank} />
        <img
          src={personaje.imagenUrl ?? imagenPersonaje(personaje.slug)}
          alt=""
          loading="lazy"
          className="h-14 w-10 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-accent">
            {personaje.nombre}
          </p>
          <p className="truncate text-[12px] text-fg-muted">
            {personaje.anime}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-bold text-accent">{votos}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            votos
          </p>
        </div>
      </Link>
    </motion.li>
  )
}

function RankBadge({ rank }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold ${
        rank === 1
          ? 'bg-yellow-500/15 text-yellow-400'
          : rank === 2
            ? 'bg-zinc-400/15 text-zinc-300'
            : rank === 3
              ? 'bg-orange-500/15 text-orange-400'
              : 'bg-surface-alt text-fg-muted'
      }`}
    >
      {rank === 1 ? <Trophy className="h-5 w-5" /> : rank}
    </span>
  )
}

export default RankingPage
