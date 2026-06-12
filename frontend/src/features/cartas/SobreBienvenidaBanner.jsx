import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Gift, Sparkles } from 'lucide-react'
import Button from '../../components/Button'
import Dialog from '../../components/Dialog'
import PackOpening from './PackOpening'
import { useAuth } from '../../contexts/AuthContext'
import { ApiError } from '../../lib/api'
import { SOBRE_ABIERTO_EVENT, emitAppEvent } from '../../lib/app-events'
import {
  useColeccionResumen,
  useDescargarCarta,
  useSobreBienvenida,
} from '../../hooks/useCartas'

// IMPORTANTE: PackOpening se importa EAGER a propósito. Lazy-loaded (probado en
// la PR 330) hacía que, si el chunk fallaba al cargar tras un deploy, el revelado
// del sobre desapareciera con fallback nulo y el usuario perdiera el regalo ya
// consumido. Empaquetado con la página, ya está en memoria al pulsar abrir.

// El gancho de reenganche (idea 7): tras abrir el sobre invitamos a la acción
// diaria que alimenta la economía de cartas.
const HOOK_VOTAR = {
  to: '/votar',
  label: 'Vota duelos y gana monedas para tu próximo sobre',
}

/**
 * Sobre de bienvenida en la home. Dos puntos de entrada:
 *  1) Un modal de intro que AUTO-APARECE la primera vez que el usuario tiene un
 *     sobre disponible (una vez por usuario, flag en localStorage) — para que el
 *     regalo no dependa de descubrir el banner.
 *  2) El banner bajo el hero, siempre visible como entrada secundaria.
 * Se auto-oculta si el usuario no está logueado o ya lo reclamó (flag
 * sobreBienvenidaDisponible de la colección). Al abrirlo reusa la animación de
 * PackOpening en un Dialog.
 */
function SobreBienvenidaBanner() {
  const { user } = useAuth()
  const coleccionQ = useColeccionResumen()
  const reclamar = useSobreBienvenida()
  const descargarCarta = useDescargarCarta()
  const [reveal, setReveal] = useState(null)
  const [introDismissed, setIntroDismissed] = useState(false)

  const disponible = Boolean(coleccionQ.data?.sobreBienvenidaDisponible)

  // Auto-surface (idea de activación): la primera vez que hay un sobre disponible
  // para este usuario, mostramos un modal de intro imposible de ignorar — el
  // regalo es la mejor herramienta de activación y no debe depender de que el
  // usuario baje a ver el banner. Una sola vez por usuario (flag en localStorage);
  // el banner queda como entrada secundaria.
  const promptKey = user ? `as_welcome_pack_prompted:${user.id ?? user.username}` : null
  const yaPrompteado = useMemo(() => {
    if (!promptKey) return true
    try {
      return localStorage.getItem(promptKey) === '1'
    } catch {
      return false // incógnito: mostrar igual (no se podrá persistir)
    }
  }, [promptKey])

  // introOpen es estado DERIVADO (no se setea en un efecto, para no romper el
  // ciclo de render / la regla react-hooks/set-state-in-effect). Se oculta al
  // descartarlo o al pasar a la animación de apertura.
  const introOpen = disponible && !yaPrompteado && !introDismissed && !reveal

  // Persistir "ya prompteado" cuando el intro se muestra. Efecto SOLO de I/O
  // (localStorage), sin setState.
  useEffect(() => {
    if (introOpen && promptKey) {
      try {
        localStorage.setItem(promptKey, '1')
      } catch {
        // localStorage no disponible (incógnito): se muestra igual, sin persistir.
      }
    }
  }, [introOpen, promptKey])

  if (!user || !disponible) {
    return null
  }

  const descargandoId = descargarCarta.isPending ? descargarCarta.variables?.id : null

  async function abrir() {
    try {
      const res = await reclamar.mutateAsync()
      setReveal(res)
      // Señal plana para oyentes desacoplados (onboarding): sobre abierto.
      emitAppEvent(SOBRE_ABIERTO_EVENT)
    } catch (err) {
      // 409 = el backend ya tenía el sobre reclamado (idempotencia correcta);
      // el cliente tenía estado obsoleto y mostraba la oferta igualmente. En
      // vez de un error crudo, informamos y refrescamos la colección: el flag
      // sobreBienvenidaDisponible pasa a false y el banner/modal se ocultan
      // solos (el guard `if (!disponible) return null`).
      if (err instanceof ApiError && err.status === 409) {
        toast.info('Ya habías reclamado tu sobre de bienvenida.')
        setIntroDismissed(true)
        coleccionQ.refetch()
        return
      }
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
      <div
        data-tour="sobre-bienvenida"
        className="relative overflow-hidden rounded-2xl border border-gold/45 bg-gradient-to-br from-accent/15 via-surface/85 to-surface-alt/80 p-5 shadow-aura backdrop-blur-sm sm:p-6"
      >
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
              <p className="text-[11px] font-black text-gold">
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
        open={introOpen}
        onClose={() => setIntroDismissed(true)}
        titleId="intro-bienvenida-title"
        panelClassName="max-w-md overflow-hidden p-0"
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 via-surface to-surface-alt p-6 text-center sm:p-8">
          <Sparkles
            className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 text-gold/15"
            aria-hidden="true"
          />
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/40 bg-gold-soft text-gold shadow-aura">
            <Gift className="h-8 w-8" aria-hidden="true" />
          </span>
          <p className="text-[11px] font-black text-gold">
            Regalo de bienvenida
          </p>
          <h2
            id="intro-bienvenida-title"
            className="mt-1 text-2xl font-black leading-tight text-fg-strong"
          >
            ¡Tienes un sobre especial!
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-fg-muted">
            4 cartas + 1 <span className="font-black text-electric">ESPECIAL</span> garantizada,
            gratis y una sola vez. Ábrelo y empieza tu colección.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button
              onClick={() => {
                setIntroDismissed(true)
                abrir()
              }}
              disabled={reclamar.isPending}
              size="lg"
              className="w-full sm:w-auto"
            >
              <Gift className="h-5 w-5" aria-hidden="true" />
              {reclamar.isPending ? 'Abriendo...' : 'Ábrelo ahora'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIntroDismissed(true)}>
              Más tarde
            </Button>
          </div>
        </div>
      </Dialog>

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
