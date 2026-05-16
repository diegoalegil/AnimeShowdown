import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Trophy, Vote } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import Avatar from '../components/Avatar'
import { endpoints } from '../lib/api'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const PERIODOS = [
  { id: 'all', label: 'All-time', icon: Trophy },
  { id: 'mes', label: 'Este mes', icon: Calendar },
  { id: 'semana', label: 'Esta semana', icon: Clock },
]

/**
 * Leaderboard de top voters (Plan v2 §11.9). Tabs semana/mes/all-time.
 * Lista de top 20 usuarios por count de votos en el periodo. Cada item
 * linkea a `/u/{username}` perfil público.
 *
 * <p>El backend devuelve username + avatarUrl + count. Sin email u otros
 * datos privados — el endpoint es público (sin auth).
 */
function LeaderboardsPage() {
  useSeo({
    title: 'Top voters',
    description:
      'Los usuarios que más votan en AnimeShowdown. Leaderboard semanal, mensual y all-time. Cada perfil clickable a /u/{username}.',
  })

  const [periodo, setPeriodo] = useState('all')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['top-voters', periodo],
    queryFn: () => endpoints.topVoters({ periodo, limit: 20 }),
    staleTime: 60_000,
  })

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Top voters', path: '/leaderboards' },
        ])}
      />
      <div className="mx-auto max-w-3xl">
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            <Vote className="h-3 w-3" />
            Leaderboard
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Top voters
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Los usuarios que más votan dan forma al ranking ELO global.
            Cada voto cuenta — aquí los héroes silenciosos.
          </p>
        </motion.header>

        <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {PERIODOS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriodo(id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                periodo === id
                  ? 'bg-accent text-bg'
                  : 'text-fg-muted hover:bg-surface-alt hover:text-fg-strong'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
        {isError && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-[13px] text-rose-300">
            No se pudo cargar el leaderboard. Reintenta en unos segundos.
          </p>
        )}
        {!isLoading && !isError && (!data || data.length === 0) && (
          <div className="rounded-lg border border-dashed border-border bg-surface-alt/40 p-8 text-center text-[13px] text-fg-muted">
            Aún no hay votos en esta ventana. Vuelve cuando haya tráfico real.
          </div>
        )}
        {!isLoading && !isError && data && data.length > 0 && (
          <ol className="flex flex-col gap-2">
            {data.map((voter, i) => (
              <FilaVoter key={voter.username} rank={i + 1} voter={voter} />
            ))}
          </ol>
        )}

        <div className="mt-10 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-fg-muted">
            ¿Cómo subo?
          </h2>
          <p className="text-[13px] leading-relaxed text-fg-muted">
            Cada voto en{' '}
            <Link to="/votar" className="text-accent hover:underline">
              /votar
            </Link>{' '}
            o en cualquier torneo activo cuenta. Mira el{' '}
            <Link to="/ranking" className="text-accent hover:underline">
              ranking ELO global
            </Link>{' '}
            para ver qué personajes están más reñidos y entra en{' '}
            <Link to="/torneos" className="text-accent hover:underline">
              torneos activos
            </Link>{' '}
            para acumular votos en eventos.
          </p>
        </div>
      </div>
    </section>
  )
}

function FilaVoter({ rank, voter }) {
  const medalla = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
  return (
    <li>
      <Link
        to={`/u/${encodeURIComponent(voter.username)}`}
        aria-label={`Rank #${rank} — ${voter.username}, ${voter.votos} votos`}
        className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 transition-all hover:border-accent/40 hover:bg-surface-alt sm:gap-4 sm:px-5"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg font-mono text-sm font-bold text-fg-muted">
          {medalla ?? `#${rank}`}
        </span>
        <Avatar user={voter} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-accent">
            {voter.username}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-bold text-accent">
            {voter.votos}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">
            votos
          </p>
        </div>
      </Link>
    </li>
  )
}

export default LeaderboardsPage
