import { useState } from 'react'
import { toast } from 'sonner'
import { MailWarning } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { endpoints, ApiError } from '../lib/api'

/**
 * Banner persistente que recuerda al usuario verificar su email.
 *
 * Se renderiza solo cuando `user.estadoVerificacion === 'PENDIENTE'`. Una
 * vez verificado (ya sea por click en el link del email o por refresh de
 * sesión que recibe el estado actualizado del backend), el componente
 * devuelve null y desaparece sin animación.
 *
 * Sticky bajo el Header (top-16 ~ 64px). Color amber porque es warning
 * informativo, distinto del magenta del accent del proyecto (reservado
 * para acciones positivas).
 */
function EmailVerifyBanner() {
  const { user } = useAuth()
  const [reenviando, setReenviando] = useState(false)
  const [yaReenviado, setYaReenviado] = useState(false)

  if (!user || user.estadoVerificacion !== 'PENDIENTE') {
    return null
  }

  const handleReenviar = async () => {
    if (reenviando || yaReenviado) return
    setReenviando(true)
    try {
      await endpoints.resendVerification()
      setYaReenviado(true)
      toast.success('Email enviado', {
        description: 'Revisa tu bandeja en unos segundos.',
      })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error de red'
      toast.error('No se pudo reenviar', { description: msg })
    } finally {
      setReenviando(false)
    }
  }

  return (
    <div
      className="sticky top-16 z-30 border-b border-warning/30 bg-warning/10 backdrop-blur"
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-2.5 sm:px-8">
        <MailWarning className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="flex-1 text-[13px] text-warning">
          <span className="font-semibold">Verifica tu email</span>
          <span className="text-warning/80">
            {' '}
            para poder votar. Revisa tu bandeja y pincha el enlace que te enviamos.
          </span>
        </p>
        <button
          type="button"
          onClick={handleReenviar}
          disabled={reenviando || yaReenviado}
          className="shrink-0 rounded-md border border-warning/40 bg-warning/10 px-3 py-1 text-[12px] font-semibold text-warning transition-colors hover:bg-warning/20 disabled:opacity-50"
        >
          {yaReenviado ? '✓ Enviado' : reenviando ? 'Enviando…' : 'Reenviar email'}
        </button>
      </div>
    </div>
  )
}

export default EmailVerifyBanner
