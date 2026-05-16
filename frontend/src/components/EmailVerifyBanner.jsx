import { useState } from 'react'
import { toast } from 'sonner'
import { MailWarning } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { endpoints, ApiError } from '../lib/api'

/**
 * Banner persistente que recuerda al usuario verificar su email (Plan v2 §2.4).
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
      className="sticky top-16 z-30 border-b border-amber-500/30 bg-amber-500/10 backdrop-blur"
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-2.5 sm:px-8">
        <MailWarning className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
        <p className="flex-1 text-[13px] text-amber-100">
          <span className="font-semibold">Verifica tu email</span>
          <span className="text-amber-200/80">
            {' '}
            para poder votar. Revisa tu bandeja y pincha el enlace que te enviamos.
          </span>
        </p>
        <button
          type="button"
          onClick={handleReenviar}
          disabled={reenviando || yaReenviado}
          className="shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[12px] font-semibold text-amber-100 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
        >
          {yaReenviado ? '✓ Enviado' : reenviando ? 'Enviando…' : 'Reenviar email'}
        </button>
      </div>
    </div>
  )
}

export default EmailVerifyBanner
