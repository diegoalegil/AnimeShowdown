import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Calendar, Clock, Crown, Trophy, Vote } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import { endpoints } from '../lib/api'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

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
 * Leaderboard de pioneros. Tabs semana/mes/all-time.
 * Lista de top 20 usuarios por count de votos en el periodo. Cada item
 * linkea a `/u/{username}` perfil público.
 *
 * <p>El backend devuelve username + avatarUrl + count. Sin email u otros
 * datos privados — el endpoint es público (sin auth).
 */
function LeaderboardsPage() {
  useSeo({
    title: 'Pioneros de AnimeShowdown',
    description:
      'Los usuarios que más ayudan a mover el ranking ELO de AnimeShowdown. Leaderboard semanal, mensual y all-time.',
  })

  const [periodo, setPeriodo] = useState('all')
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['top-voters', periodo],
    queryFn: () => endpoints.topVoters({ periodo, limit: 20 }),
    staleTime: 60_000,
  })

  return (
    <VisualPageShell visual={BRAND_VISUALS.ranking} contentClassName="mx-auto max-w-6xl" lateralKanji={{left: "覇", right: "者"}} atmosphere="tribute">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Pioneros', path: '/leaderboards' },
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
            Comunidad
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Pioneros de AnimeShowdown
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Los primeros votos son los que dan forma al ranking ELO global.
            Aquí celebramos a quienes están construyendo la liga desde el inicio.
          </p>
        </motion.header>

        <SenpaiDelMes />

        <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {PERIODOS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriodo(id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                periodo === id
                  ? 'bg-accent text-white'
                  : 'text-fg-muted hover:bg-surface-alt hover:text-fg-strong'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {isLoading && (
          <LeaderboardSkeleton />
        )}
        {isError && (
          <EmptyState
            icon={AlertTriangle}
            title="No pudimos cargar el leaderboard"
            description="Reintenta en unos segundos para volver a consultar esta ventana de votos."
            action={
              <button
                type="button"
                onClick={() => refetch()}
                className="as-button-primary rounded-lg px-5 py-3 text-sm font-black"
              >
                Reintentar
              </button>
            }
          />
        )}
        {!isLoading && !isError && (!data || data.length === 0) && (
          <EmptyState scene
            icon={Clock}
            title="Sin votos en esta ventana"
            action={{ to: '/votar', label: 'Votar ahora' }}
          >
            Todavía no hay tráfico suficiente para esta ventana de tiempo.
            Esta tabla solo muestra votos reales. Sé tú quien inaugure la ventana.
          </EmptyState>
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
            <Link to="/votar" className="text-gold underline decoration-gold/60 underline-offset-2 hover:text-fg-strong">
              /votar
            </Link>{' '}
            o en cualquier torneo activo cuenta. Mira el{' '}
            <Link to="/ranking" className="text-gold underline decoration-gold/60 underline-offset-2 hover:text-fg-strong">
              ranking ELO global
            </Link>{' '}
            para ver qué personajes están más reñidos y entra en{' '}
            <Link to="/torneos" className="text-gold underline decoration-gold/60 underline-offset-2 hover:text-fg-strong">
              torneos activos
            </Link>{' '}
            para acumular votos en eventos. Mientras la comunidad crece, esta
            tabla premia a quienes empujan el proyecto desde sus primeras rondas.
          </p>
        </div>
      </div>
    </VisualPageShell>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} variant="line" className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}

/**
 * Sección "Senpai del mes" — destaca al Top Predictor
 * del mes actual con un badge especial encima del leaderboard de voters.
 * Si nadie tiene predicciones acertadas, no se muestra.
 *
 * <p>Usa el endpoint de leaderboard de predicciones que ya existe
 * (`/api/predicciones/leaderboard?dias=30`) tomando solo el item [0].
 */
function SenpaiDelMes() {
  const { data } = useQuery({
    queryKey: ['predicciones', 'senpai-mes'],
    queryFn: () => endpoints.leaderboardPredicciones({ dias: 30, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  if (!data || data.length === 0) return null
  const top = data[0]

  return (
    <div className="mb-6 overflow-hidden rounded-xl border-2 border-gold/40 bg-gradient-to-r from-gold/10 via-gold/5 to-transparent p-5">
      <div className="flex items-center gap-4">
        <Crown className="h-8 w-8 shrink-0 text-gold" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            <span lang="ja">先輩</span> · Senpai del mes
          </p>
          <p className="mt-0.5 text-xl font-extrabold text-fg-strong">
            <Link
              to={`/u/${encodeURIComponent(top.username)}`}
              className="hover:underline"
            >
              {top.username}
            </Link>
          </p>
          <p className="text-[12px] text-fg-muted">
            Predictor más acertado de los últimos 30 días ·{' '}
            <strong className="text-gold">{top.aciertos} aciertos</strong>
          </p>
        </div>
      </div>
    </div>
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
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-gold">
            {voter.username}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-bold text-gold">
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
