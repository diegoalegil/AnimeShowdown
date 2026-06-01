import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Share2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Section from '../components/Section'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import CartaFace from '../features/cartas/CartaFace'
import { useCartaPublica } from '../hooks/useCartas'
import { useSeo } from '../hooks/useSeo'
import { shareOrCopy } from '../lib/share'
import { recordDailyShare } from '../lib/dailyProgress'

function CartaPublicaPage() {
  const { cartaId } = useParams()
  const { data: carta, isLoading, error } = useCartaPublica(cartaId)

  useSeo({
    title: carta ? `Carta especial de ${carta.personajeNombre}` : 'Carta especial',
    description: carta
      ? `${carta.personajeNombre} de ${carta.anime} en carta especial compartible de AnimeShowdown.`
      : 'Carta especial compartible de AnimeShowdown.',
    noindex: error?.status === 404,
  })

  async function compartir() {
    if (!carta) return
    try {
      const result = await shareOrCopy({
        title: `Carta especial de ${carta.personajeNombre}`,
        text: `${carta.personajeNombre} de ${carta.anime} en carta especial de AnimeShowdown.`,
        url: `/cartas/${carta.id}`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Carta compartida' : 'Carta copiada')
    } catch (shareError) {
      toast.error('No se pudo compartir', {
        description: shareError?.message || 'Copia el enlace manualmente.',
      })
    }
  }

  if (isLoading) {
    return (
      <Section eyebrow="Carta" title="Cargando carta">
        <div className="mx-auto aspect-[2/3] w-full max-w-xs animate-pulse rounded-2xl bg-surface-alt" />
      </Section>
    )
  }

  if (error || !carta) {
    return (
      <Section eyebrow="Carta" title="Carta no disponible">
        <EmptyState
          icon={Sparkles}
          title="No pudimos cargar esta carta"
          description="Puede que la carta ya no este disponible para compartir."
          action={{ to: '/cartas', label: 'Ir a cartas' }}
        />
      </Section>
    )
  }

  return (
    <Section eyebrow="Carta especial" title={carta.personajeNombre} description={carta.anime}>
      <Link
        to="/cartas"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-gold"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a cartas
      </Link>
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-center">
        <CartaFace carta={carta} eager className="mx-auto w-full max-w-xs" />
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gold">
            {carta.rareza}
          </p>
          <h1 className="mt-2 text-2xl font-black text-fg-strong">{carta.personajeNombre}</h1>
          <p className="mt-1 text-fg-muted">{carta.anime}</p>
          {carta.variante && (
            <p className="mt-3 rounded-lg border border-gold/30 bg-gold-soft px-3 py-2 text-sm font-bold text-gold">
              {carta.variante}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={compartir}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Compartir
            </Button>
            <Button as={Link} to={`/personajes/${carta.personajeSlug}`} variant="secondary">
              Ver ficha
            </Button>
          </div>
        </div>
      </div>
    </Section>
  )
}

export default CartaPublicaPage
