import { Link } from 'react-router-dom'
import { ArrowRight, Home, MapPinned } from 'lucide-react'
import { EmptyStateScene, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import { useSeo } from '../hooks/useSeo'

function NotFoundPage() {
  useSeo({ title: '404 — Página no encontrada', noindex: true })

  const visual = {
    ...BRAND_VISUALS.error,
    image: '/assets/error-scenes/not-found-lost-shinobi.svg',
    kanji: '迷',
    title: '404',
  }

  return (
    <VisualPageShell
      visual={visual}
      className="flex min-h-[calc(100svh-5rem)] items-center py-16 sm:py-20"
      contentClassName="mx-auto w-full max-w-5xl"
    >
      <h1 className="sr-only">404 — Página no encontrada</h1>
      <EmptyStateScene
        visual={visual}
        icon={MapPinned}
        title="Esta ruta se perdió entre la niebla"
        className="min-h-[28rem]"
      >
        <p>
          La página que buscas no existe o cambió de lugar. Vuelve al inicio o
          entra al archivo de personajes para seguir explorando AnimeShowdown.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-accent/50 bg-accent px-5 py-3 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
          >
            <Home className="h-4 w-4" />
            Volver al inicio
          </Link>
          <Link
            to="/personajes"
            className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-5 py-3 text-sm font-bold text-fg-strong transition-colors hover:border-gold/45 hover:text-gold"
          >
            Ver personajes
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </EmptyStateScene>
    </VisualPageShell>
  )
}

export default NotFoundPage
