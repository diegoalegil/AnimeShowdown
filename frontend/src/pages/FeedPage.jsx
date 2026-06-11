import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, LogIn, Compass } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useFeed } from '../hooks/useFeed'
import { useSeo } from '../hooks/useSeo'
import { ActividadItem } from '../components/ActividadItem'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

/**
 * B7 §2: feed de comunidad. Muestra la actividad reciente de los usuarios que
 * sigues (votos, logros, torneos). Reusa el renderer compartido ActividadItem
 * con autoría. Empty-states:
 *   - No logueado → CTA login/registro (embudo de captación, NO 404).
 *   - Logueado sin seguidos → CTA a explorar la comunidad.
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

      {!user ? <EmptyNoLogueado /> : <FeedContenido />}
    </VisualPageShell>
  )
}

function FeedContenido() {
  const { data, isLoading, isError } = useFeed({ size: 30 })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-[13px] text-fg-muted">
        No pudimos cargar el feed ahora mismo. Inténtalo de nuevo en un momento.
      </p>
    )
  }

  if (!data?.sigueAAlguien) return <EmptySinSeguidos />

  const items = data.items || []
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-[13px] text-fg-muted">
        Aún no hay actividad reciente de quienes sigues. Vuelve pronto: en cuanto
        voten, desbloqueen un logro o creen un torneo, aparecerá aquí.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, idx) => (
        <ActividadItem
          key={`${item.tipo}-${item.fecha}-${idx}`}
          item={item}
          showAuthor
        />
      ))}
    </ul>
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

function EmptySinSeguidos() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
        <Compass className="h-6 w-6" />
      </span>
      <h2 className="mb-2 text-lg font-bold text-fg-strong">Aún no sigues a nadie</h2>
      <p className="mx-auto mb-6 max-w-md text-[13px] text-fg-muted">
        Explora la comunidad y sigue a otros fans para llenar tu feed con su
        actividad. Empieza por el ranking y entra en sus perfiles.
      </p>
      <Link
        to="/ranking"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        <Compass className="h-4 w-4" />
        Explorar la comunidad
      </Link>
    </div>
  )
}

export default FeedPage
