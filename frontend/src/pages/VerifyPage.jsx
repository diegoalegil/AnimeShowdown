import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, MailWarning, ArrowRight } from 'lucide-react'
import { endpoints, refreshSession } from '../lib/api'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/**
 * Página /verify?token=XXX que cierra el flujo de email verification
 * del Plan v2 §2.4.
 *
 * Al montar, llama GET /api/auth/verify?token=... una sola vez. Posibles
 * resultados:
 *   - 200 { verificado: true }  → éxito. Refrescamos la sesión para que
 *     AuthContext reciba el user con estadoVerificacion ACTIVO y el
 *     EmailVerifyBanner desaparezca al volver a navegar.
 *   - 400 { verificado: false } → token inválido o expirado. CTA para
 *     pedir reenvio desde el banner.
 *   - Network error → mensaje genérico, CTA reintentar.
 */
function VerifyPage() {
  useDocumentTitle('Verificando email')
  const [params] = useSearchParams()
  const token = params.get('token')

  // El estado 'sin_token' se deriva sincrónicamente del query string para
  // evitar setState dentro del effect (react-compiler marca cascading
  // renders cuando setState va al inicio de un useEffect). El estado
  // interno solo trackea el resultado de la llamada async.
  const [resultado, setResultado] = useState('verificando')
  // 'verificando' | 'ok' | 'invalido' | 'error_red'

  const estado = token ? resultado : 'sin_token'

  useEffect(() => {
    if (!token) return
    let cancelado = false
    endpoints
      .verifyEmail(token)
      .then((data) => {
        if (cancelado) return
        if (data?.verificado) {
          setResultado('ok')
          // Refresca la sesión para actualizar AuthContext y que el banner
          // desaparezca sin necesidad de F5 manual.
          refreshSession().catch(() => {})
        } else {
          setResultado('invalido')
        }
      })
      .catch(() => {
        if (cancelado) return
        setResultado('error_red')
      })
    return () => {
      cancelado = true
    }
  }, [token])

  return (
    <section className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center"
      >
        {estado === 'verificando' && <Verificando />}
        {estado === 'ok' && <Exito />}
        {estado === 'invalido' && <TokenInvalido />}
        {estado === 'sin_token' && <SinToken />}
        {estado === 'error_red' && <ErrorRed />}
      </motion.div>
    </section>
  )
}

function Verificando() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <p className="text-fg-muted">Verificando tu email…</p>
    </div>
  )
}

function Exito() {
  return (
    <div className="flex flex-col items-center gap-4">
      <CheckCircle2 className="h-14 w-14 text-emerald-400" />
      <h1 className="text-2xl font-bold text-fg-strong">¡Email verificado!</h1>
      <p className="text-fg-muted">
        Tu cuenta está activa. Ya puedes votar en los torneos.
      </p>
      <Link
        to="/torneos"
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
      >
        Ver torneos
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function TokenInvalido() {
  return (
    <div className="flex flex-col items-center gap-4">
      <XCircle className="h-14 w-14 text-red-400" />
      <h1 className="text-2xl font-bold text-fg-strong">Enlace inválido o caducado</h1>
      <p className="text-fg-muted">
        El enlace de verificación ya no es válido. Si tienes la sesión iniciada,
        pulsa <span className="font-semibold text-fg-strong">Reenviar email</span> en
        el banner superior para recibir uno nuevo.
      </p>
      <Link
        to="/login"
        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-5 py-2.5 text-sm font-semibold text-fg-strong hover:border-accent"
      >
        Iniciar sesión
      </Link>
    </div>
  )
}

function SinToken() {
  return (
    <div className="flex flex-col items-center gap-4">
      <MailWarning className="h-14 w-14 text-amber-400" />
      <h1 className="text-2xl font-bold text-fg-strong">Falta el token</h1>
      <p className="text-fg-muted">
        Esta página espera un parámetro <code>?token=...</code> que llega en el
        enlace que te enviamos por email. Revisa tu bandeja y vuelve a pinchar
        el botón de confirmar.
      </p>
    </div>
  )
}

function ErrorRed() {
  return (
    <div className="flex flex-col items-center gap-4">
      <XCircle className="h-14 w-14 text-red-400" />
      <h1 className="text-2xl font-bold text-fg-strong">No se pudo verificar</h1>
      <p className="text-fg-muted">
        Hubo un problema al contactar con el servidor. Espera unos segundos y
        recarga esta página.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-5 py-2.5 text-sm font-semibold text-fg-strong hover:border-accent"
      >
        Reintentar
      </button>
    </div>
  )
}

export default VerifyPage
