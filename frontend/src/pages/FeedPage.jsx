import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, LogIn } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import FederationChronicle from '../features/feed/FederationChronicle'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

/**
 * B7 §2: feed de comunidad como Crónica de la federación — línea de tiempo
 * con hilo de tinta scroll-driven y sellos hanko por tipo de evento
 * (features/feed/FederationChronicle). Empty-states:
 *   - No logueado → CTA login/registro (embudo de captación, NO 404).
 *   - Logueado sin seguidos → escena + perfiles sugeridos (en la crónica).
 */
function FeedPage() {
  const { user } = useAuth()
  useSeo({
    title: 'Feed de comunidad',
    description: 'La actividad reciente de los fans que sigues en AnimeShowdown.',
  })

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.perfilHero}
      contentClassName="mx-auto max-w-3xl"
      density="low"
      lateralKanji={{ left: '仲', right: '間' }}
    >
      <motion.header
        className="mb-6 flex flex-col items-start gap-3"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold text-gold">
          <Users className="h-3 w-3" />
          Comunidad
        </span>
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
          Feed de comunidad
        </h1>
        <p className="max-w-2xl text-fg-muted">
          La actividad reciente de los fans que sigues: sus votos, logros y
          torneos, en una sola línea de tiempo.
        </p>
      </motion.header>

      {!user ? <EmptyNoLogueado /> : <FederationChronicle />}
    </VisualPageShell>
  )
}

function EmptyNoLogueado() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent-text">
        <Users className="h-6 w-6" />
      </span>
      <h2 className="mb-2 text-lg font-bold text-fg-strong">
        Sigue a otros fans y no te pierdas nada
      </h2>
      <p className="mx-auto mb-6 max-w-md text-[13px] text-fg-muted">
        Crea tu cuenta para seguir a otros fans y ver aquí su actividad: a quién
        votan, qué logros desbloquean y los torneos que crean.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/register"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <Users className="h-4 w-4" />
          Crear cuenta
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-5 py-2.5 text-sm font-semibold text-fg-strong transition-colors hover:border-accent/40"
        >
          <LogIn className="h-4 w-4" />
          Entrar
        </Link>
      </div>
    </div>
  )
}

export default FeedPage
