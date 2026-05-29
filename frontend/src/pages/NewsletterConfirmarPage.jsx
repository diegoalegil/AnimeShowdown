import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { endpoints } from '../lib/api'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

/**
 * Página de confirmación de suscripción a newsletter.
 *
 * Se llega aquí desde el link enviado por email:
 * https://animeshowdown.dev/newsletter/confirmar?token=XXX
 *
 * Estados:
 *   - loading: consultando al backend.
 *   - ok: token válido, suscripción confirmada.
 *   - error: token inválido o expirado.
 */
function NewsletterConfirmarPage() {
  useSeo({ title: 'Confirmar suscripción', noindex: true })
  const [params] = useSearchParams()
  const token = params.get('token')
  // Estado inicial calculado en lazy init: si falta token directamente
  // empezamos en 'error' sin pasar por 'loading' y sin tener que llamar
  // setState dentro del useEffect (React Compiler rule).
  const [estado, setEstado] = useState(() =>
    token
      ? { tipo: 'loading' }
      : {
          tipo: 'error',
          mensaje: 'Falta el token de confirmación en la URL.',
        },
  )
  const mountedRef = useRef(false)
  const startedTokenRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!token || startedTokenRef.current === token) return
    startedTokenRef.current = token
    endpoints
      .confirmarNewsletter(token)
      .then((res) => {
        if (!mountedRef.current) return
        setEstado({
          tipo: 'ok',
          mensaje: res?.message ?? 'Suscripción confirmada.',
        })
      })
      .catch((err) => {
        if (!mountedRef.current) return
        setEstado({
          tipo: 'error',
          mensaje:
            err?.body?.message ||
            err?.message ||
            'No se pudo confirmar. El link puede haber caducado.',
        })
      })
  }, [token])

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.authRegister} lateralKanji={{left: "加", right: "入"}}
      className="flex min-h-[calc(100vh-6rem)] items-center justify-center"
      contentClassName="w-full max-w-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full"
      >
        {estado.tipo === 'loading' && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-fg-muted" />
            <p className="text-[13px] text-fg-muted">
              Confirmando tu suscripción…
            </p>
          </div>
        )}
        {estado.tipo === 'ok' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <h1 className="text-2xl tracking-tight">¡Listo!</h1>
            <p className="text-[13px] text-success/80">{estado.mensaje}</p>
            <Link
              to="/"
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              Volver a la home
            </Link>
          </div>
        )}
        {estado.tipo === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 p-8 text-center">
            <XCircle className="h-10 w-10 text-danger" />
            <h1 className="text-2xl tracking-tight">No se pudo confirmar</h1>
            <p className="text-[13px] text-danger/80">{estado.mensaje}</p>
            <p className="text-[12px] text-fg-muted">
              Puedes volver a suscribirte desde el footer de cualquier página.
            </p>
            <Link
              to="/"
              className="mt-2 inline-flex items-center justify-center rounded-lg border border-border bg-bg px-5 py-2.5 text-sm font-semibold text-fg-strong transition-colors hover:border-accent/40"
            >
              Volver a la home
            </Link>
          </div>
        )}
      </motion.div>
    </VisualPageShell>
  )
}

export default NewsletterConfirmarPage
