import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Calendar, Clock, Trophy, Vote } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import PioneersPodium from '../features/leaderboards/PioneersPodium'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
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
  // Senpai del mes: top predictor real de los últimos 30 días (item [0]).
  const { data: senpaiData } = useQuery({
    queryKey: ['predicciones', 'senpai-mes'],
    queryFn: () => endpoints.leaderboardPredicciones({ dias: 30, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })
  const senpai = senpaiData?.[0] ?? null

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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-fg-muted">
            <Vote className="h-3 w-3" />
            Comunidad
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Pioneros de AnimeShowdown
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Los primeros votos son los que dan forma al ranking ELO global.
            Aquí celebramos a quienes están construyendo la liga desde el inicio.
          </p>
        </motion.header>

        <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {PERIODOS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriodo(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
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
          <PioneersPodium voters={data} senpai={senpai} />
        )}

        <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
          <h2 className="mb-2 text-sm font-semibold text-fg-muted">
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


export default LeaderboardsPage
