import { useState } from 'react'
import { toast } from 'sonner'
import { Gift, Sparkles } from 'lucide-react'
import Button from '../../components/Button'
import Dialog from '../../components/Dialog'
import PackOpening from './PackOpening'
import { useAuth } from '../../contexts/AuthContext'
import {
  useColeccion,
  useDescargarCarta,
  useSobreBienvenida,
} from '../../hooks/useCartas'

// El gancho de reenganche (idea 7): tras abrir el sobre invitamos a la acción
// diaria que alimenta la economía de cartas.
const HOOK_VOTAR = {
  to: '/votar',
  label: 'Vota duelos y gana monedas para tu próximo sobre',
}

/**
 * Banner del sobre de bienvenida bajo el hero de la home. Se auto-oculta si el
 * usuario no está logueado o ya lo reclamó (flag sobreBienvenidaDisponible de
 * la colección). Al abrirlo reusa la animación de PackOpening en un Dialog.
 */
function SobreBienvenidaBanner() {
  const { user } = useAuth()
  const coleccionQ = useColeccion()
  const reclamar = useSobreBienvenida()
  const descargarCarta = useDescargarCarta()
  const [reveal, setReveal] = useState(null)

  const disponible = Boolean(coleccionQ.data?.sobreBienvenidaDisponible)
  if (!user || !disponible) {
    return null
  }

  const descargandoId = descargarCarta.isPending ? descargarCarta.variables?.id : null

  async function abrir() {
    try {
      const res = await reclamar.mutateAsync()
      setReveal(res)
    } catch {
      toast.error('No se pudo abrir tu sobre de bienvenida', {
        description: 'Inténtalo de nuevo en unos segundos.',
      })
    }
  }

  function descargar(carta) {
    if (!carta?.poseida) return
    descargarCarta.mutate(carta)
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
      <div className="relative overflow-hidden rounded-2xl border border-gold/45 bg-gradient-to-br from-accent/15 via-surface/85 to-surface-alt/80 p-5 shadow-aura backdrop-blur-sm sm:p-6">
        <Sparkles
          className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 text-gold/15"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gold/40 bg-gold-soft text-gold">
              <Gift className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gold">
                Regalo de bienvenida
              </p>
              <h2 className="mt-0.5 text-lg font-black leading-tight text-fg-strong sm:text-xl">
                Tu sobre de bienvenida te espera
              </h2>
              <p className="mt-1 text-sm leading-6 text-fg-muted">
                4 cartas + 1 <span className="font-black text-electric">ESPECIAL</span> garantizada, gratis y una sola vez.
              </p>
            </div>
          </div>
          <Button
            onClick={abrir}
            disabled={reclamar.isPending}
            size="lg"
            className="shrink-0"
          >
            <Gift className="h-5 w-5" aria-hidden="true" />
            {reclamar.isPending ? 'Abriendo...' : 'Ábrelo gratis'}
          </Button>
        </div>
      </div>

      <Dialog
        open={Boolean(reveal)}
        onClose={() => setReveal(null)}
        titleId="reveal-bienvenida-title"
        panelClassName="max-w-[56rem] p-2 sm:p-3"
      >
        {reveal && (
          <PackOpening
            reveal={reveal}
            puedeAbrirOtro={false}
            permitirAbrirOtro={false}
            abriendo={false}
            onAbrirOtro={() => {}}
            onCerrar={() => setReveal(null)}
            onDownload={descargar}
            descargandoId={descargandoId}
            hook={HOOK_VOTAR}
          />
        )}
      </Dialog>
    </section>
  )
}

export default SobreBienvenidaBanner
