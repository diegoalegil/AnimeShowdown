import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Swords } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import Dialog from '../Dialog'
import UsernamePicker from './UsernamePicker'
import AvatarEditor from '../../features/perfil/components/AvatarEditor'

/**
 * V-8: onboarding post primer login OAuth. Modal saltable de dos pasos
 * —elegir username + avatar— con copy de anime. Cualquier cierre (saltar,
 * backdrop, Escape, finalizar) marca el onboarding como visto en el backend
 * para no volver a mostrarlo.
 */
function OnboardingModal({ open, onClose }) {
  const { user, changeUsername, skipOnboarding, updateUser } = useAuth()
  const [step, setStep] = useState('username')
  const [cerrando, setCerrando] = useState(false)

  if (!user) return null

  // Cierre "suave": marca el onboarding como completado (idempotente en el
  // backend) y cierra. Lo usan Saltar, backdrop, Escape y Finalizar.
  const cerrarYMarcar = async () => {
    if (cerrando) return
    setCerrando(true)
    try {
      await skipOnboarding()
    } finally {
      setCerrando(false)
      onClose()
    }
  }

  const handleUsernameSubmit = async (username) => {
    await changeUsername(username)
    toast.success('Username guardado', {
      description: `A partir de ahora eres ${username}.`,
    })
    setStep('avatar')
  }

  return (
    <Dialog
      open={open}
      onClose={cerrarYMarcar}
      titleId="onboarding-title"
      panelClassName="max-w-lg"
    >
      <div className="mb-5 flex items-start gap-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-gold">
          <Swords className="h-5 w-5" />
          <span
            aria-hidden="true"
            lang="ja"
            className="absolute -right-1 -top-2 font-mono text-sm font-black text-gold/70"
          >
            始
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            Paso {step === 'username' ? '1' : '2'} de 2
          </p>
          <h2
            id="onboarding-title"
            className="mt-0.5 text-xl font-black tracking-tight text-fg-strong"
          >
            {step === 'username'
              ? 'Tu leyenda empieza con un nombre'
              : 'Ponle cara a tu campeón'}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
            {step === 'username'
              ? 'Entraste con tu cuenta y te asignamos un nombre temporal. Elige cómo quieres que te conozca la arena — podrás cambiarlo cuando quieras en Ajustes.'
              : 'Sube tu propia foto o reclama la card de tu personaje favorito como avatar. También puedes dejarlo para más tarde.'}
          </p>
        </div>
      </div>

      {step === 'username' ? (
        <UsernamePicker
          currentUsername={user.username}
          onSubmit={handleUsernameSubmit}
          submitLabel="Continuar"
          autoFocus
        />
      ) : (
        <AvatarEditor
          user={user}
          updateUser={updateUser}
          tabs={['archivo', 'catalogo']}
        />
      )}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
        {step === 'avatar' ? (
          <button
            type="button"
            onClick={() => setStep('username')}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted transition-colors hover:text-fg-strong"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Atrás
          </button>
        ) : (
          <span />
        )}
        {step === 'username' ? (
          <button
            type="button"
            onClick={cerrarYMarcar}
            disabled={cerrando}
            className="text-[13px] font-semibold text-fg-muted transition-colors hover:text-gold disabled:opacity-60"
          >
            Saltar por ahora
          </button>
        ) : (
          <button
            type="button"
            onClick={cerrarYMarcar}
            disabled={cerrando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {cerrando ? 'Guardando…' : 'Listo, ¡a la arena!'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </Dialog>
  )
}

export default OnboardingModal
