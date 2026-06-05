import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import KanjiSpinner from './KanjiSpinner'

interface GameCatalogLoadingProps {
  kanji?: string
  title?: string
  description?: string
}

function GameCatalogLoading({
  kanji = '遊',
  title = 'Preparando reto diario',
  description = 'Cargando catálogo de personajes para montar la partida.',
}: GameCatalogLoadingProps) {
  return (
    <section className="as-stage as-stage-visual flex min-h-[70vh] items-center px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
        <Link
          to="/games"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Hub de juegos
        </Link>
        <div className="as-panel flex w-full flex-col items-center gap-4 rounded-2xl p-8">
          <KanjiSpinner kanji={kanji} size="lg" tone="accent" label={title} />
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-fg-strong">
              {title}
            </h1>
            <p className="text-sm text-fg-muted">{description}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default GameCatalogLoading
