import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Check,
  Copy,
  Loader2,
  Printer,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldOff,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { endpoints, ApiError } from '../lib/api'
import PasswordInput from './PasswordInput'

/**
 * Card de "Verificación en dos pasos" para /perfil.
 *
 * Estado desactivado:
 *   - Card neutra con explicación + botón "Activar 2FA".
 *   - Click → abre Modal2faSetup (flow QR → código → backup codes).
 *
 * Estado activado:
 *   - Card verde esmeralda con icono ShieldCheck + fecha de activación.
 *   - 2 acciones: "Regenerar códigos" / "Desactivar 2FA".
 *   - Cada una abre su modal específico.
 *
 * Todas las acciones que modifican el estado de 2FA persisten en backend
 * y refrescan user.totpHabilitado vía updateUser() del AuthContext.
 */
function Card2faSeguridad() {
  const { user, updateUser } = useAuth()
  const [modal, setModal] = useState(null) // 'setup' | 'disable' | 'regenerate' | null

  const habilitado = user?.totpHabilitado === true

  return (
    <div
      className={
        habilitado
          ? 'rounded-2xl border border-success/20 bg-success/5 p-6'
          : 'rounded-2xl border border-border bg-surface p-6'
      }
    >
      <div className="mb-3 flex items-center gap-2">
        {habilitado ? (
          <ShieldCheck className="h-4 w-4 text-success" />
        ) : (
          <Shield className="h-4 w-4 text-gold" />
        )}
        <h2 className="text-lg font-bold text-fg-strong">
          Verificación en dos pasos
        </h2>
        {habilitado && (
          <span className="ml-auto inline-flex rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success">
            Activo
          </span>
        )}
      </div>
      {habilitado ? (
        <>
          <p className="mb-4 text-[12px] text-fg-muted">
            Tu cuenta pide un código de 6 dígitos cada vez que entras. Si pierdes
            la app authenticator, usa uno de tus códigos de recuperación.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModal('regenerate')}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-2.5 text-[13px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerar códigos de recuperación
            </button>
            <button
              type="button"
              onClick={() => setModal('disable')}
              className="inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/20"
            >
              <ShieldOff className="h-4 w-4" />
              Desactivar 2FA
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-[12px] text-fg-muted">
            Añade una capa extra de seguridad: tras introducir tu contraseña, te
            pediremos un código generado por tu app authenticator (Google
            Authenticator, Authy, 1Password…). Recomendado.
          </p>
          <button
            type="button"
            onClick={() => setModal('setup')}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Shield className="h-4 w-4" />
            Activar 2FA
          </button>
        </>
      )}

      <AnimatePresence>
        {modal === 'setup' && (
          <Modal2faSetup
            onClose={() => setModal(null)}
            onSuccess={() => {
              updateUser({ totpHabilitado: true })
              setModal(null)
              toast.success('2FA activado', {
                description:
                  'Guarda tus códigos de recuperación en un lugar seguro.',
              })
            }}
          />
        )}
        {modal === 'disable' && (
          <Modal2faDisable
            onClose={() => setModal(null)}
            onSuccess={() => {
              updateUser({ totpHabilitado: false })
              setModal(null)
              toast.success('2FA desactivado', {
                description: 'Ya no se pedirá código al iniciar sesión.',
              })
            }}
          />
        )}
        {modal === 'regenerate' && (
          <Modal2faRegenerate onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ----------------------------------------------------------------------
// Wrapper común de overlay + container. Lock body scroll mientras abierto.
// ----------------------------------------------------------------------

function ModalShell({ onClose, title, icon: Icon, children, wide }) {
  // focus trap completo + ESC para cerrar.
  // Antes el tab podía escapar del modal hacia elementos del header/footer
  // del fondo (WCAG 2.1 G109 modal management). Capturamos Tab/Shift+Tab
  // entre los elementos focusables del dialog y rebotamos al primer/último.
  // ESC también cierra. Body scroll lock se mantiene.
  const dialogRef = useRef(null)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // Mover foco al primer focusable del modal al montar.
    const focusables = () => Array.from(dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((el) => el.offsetParent !== null || el === document.activeElement)
    const list = focusables()
    if (list.length > 0) list[0].focus({ preventScroll: true })

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) {
        e.preventDefault()
        return
      }
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', onKey)
    return () => dialog.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${wide ? 'max-w-xl' : 'max-w-md'} rounded-2xl border border-border bg-surface p-6 shadow-2xl`}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 rounded-lg p-1 text-fg-muted transition-colors hover:bg-bg hover:text-fg-strong"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 flex items-center gap-2 pr-8">
          {Icon && <Icon className="h-5 w-5 text-gold" />}
          <h3 className="text-xl font-bold text-fg-strong">{title}</h3>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

// ----------------------------------------------------------------------
// Modal: flujo de activación (setup → enable → backup codes)
// ----------------------------------------------------------------------

function Modal2faSetup({ onClose, onSuccess }) {
  // Pasos: 'cargando' → 'codigo' → 'backupCodes'
  const [paso, setPaso] = useState('cargando')
  const [setupData, setSetupData] = useState(null) // {secret, otpauthUri, qrCodeDataUri}
  const [backupCodes, setBackupCodes] = useState(null)
  const mountedRef = useRef(false)
  const setupStartedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (setupStartedRef.current) return
    setupStartedRef.current = true
    endpoints
      .setup2fa()
      .then((data) => {
        if (!mountedRef.current) return
        setSetupData(data)
        setPaso('codigo')
      })
      .catch((err) => {
        if (!mountedRef.current) return
        toast.error('No se pudo iniciar 2FA', {
          description:
            err instanceof ApiError
              ? err.message
              : 'No se pudo conectar al servidor.',
        })
        onClose()
      })
  }, [onClose])

  if (paso === 'cargando' || !setupData) {
    return (
      <ModalShell onClose={onClose} title="Activar 2FA" icon={Shield}>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-fg-muted" />
        </div>
      </ModalShell>
    )
  }

  if (paso === 'backupCodes') {
    return (
      <ModalBackupCodes
        codes={backupCodes}
        onClose={onSuccess}
        descripcion="Guarda estos 10 códigos en un lugar seguro. Cada uno solo se puede usar una vez si pierdes el acceso a tu app authenticator."
      />
    )
  }

  return (
    <ModalShell onClose={onClose} title="Activar 2FA" icon={Shield} wide>
      <SetupForm
        setupData={setupData}
        onBackupCodes={(codes) => {
          setBackupCodes(codes)
          setPaso('backupCodes')
        }}
      />
    </ModalShell>
  )
}

function SetupForm({ setupData, onBackupCodes }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    try {
      const codigo = (data.codigo || '').replace(/\s+/g, '')
      const res = await endpoints.enable2fa(codigo)
      onBackupCodes(res.backupCodes)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      setError('codigo', { message: msg })
    }
  }

  const [secretCopiado, setSecretCopiado] = useState(false)
  // el setTimeout queda colgando si el modal se cierra
  // antes de 2s — setState en componente desmontado. Ref + cleanup.
  const copiadoTimerRef = useRef(null)
  useEffect(() => () => {
    if (copiadoTimerRef.current) clearTimeout(copiadoTimerRef.current)
  }, [])
  const copiarSecret = async () => {
    try {
      await navigator.clipboard.writeText(setupData.secret)
      setSecretCopiado(true)
      if (copiadoTimerRef.current) clearTimeout(copiadoTimerRef.current)
      copiadoTimerRef.current = setTimeout(() => {
        copiadoTimerRef.current = null
        setSecretCopiado(false)
      }, 2000)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <ol className="list-decimal space-y-1 pl-5 text-[13px] text-fg-muted">
        <li>
          Instala una app authenticator (Google Authenticator, Authy, 1Password,
          Microsoft Authenticator…) si aún no tienes.
        </li>
        <li>Escanea el código QR o pega el secret manualmente.</li>
        <li>Introduce el código de 6 dígitos que aparece en tu app.</li>
      </ol>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-bg p-4 sm:flex-row sm:items-start">
        <img
          src={setupData.qrCodeDataUri}
          alt="Código QR para 2FA"
          width={176}
          height={176}
          className="h-44 w-44 rounded-lg bg-white p-2"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[12px] font-semibold text-fg-muted">
            ¿No puedes escanear?
          </p>
          <p className="text-[12px] text-fg-muted">
            Pega este secret manualmente en tu app:
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-strong">
              {setupData.secret}
            </code>
            <button
              type="button"
              onClick={copiarSecret}
              className="shrink-0 text-fg-muted transition-colors hover:text-gold"
              aria-label="Copiar secret"
            >
              {secretCopiado ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="codigo-setup"
          className="text-[13px] font-medium text-fg-strong"
        >
          Código de 6 dígitos
        </label>
        <input
          id="codigo-setup"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus
          autoComplete="one-time-code"
          maxLength={6}
          aria-invalid={Boolean(errors.codigo)}
          aria-describedby={errors.codigo ? 'codigo-setup-error' : undefined}
          {...register('codigo', {
            required: 'Introduce el código',
            pattern: { value: /^\d{6}$/, message: 'Deben ser 6 dígitos' },
          })}
          className={`rounded-lg border bg-bg px-3.5 py-2.5 text-center font-mono text-xl text-fg-strong focus:outline-none focus:ring-2 focus:ring-gold ${
            errors.codigo ? 'border-danger' : 'border-border'
          }`}
          placeholder="123456"
        />
        {errors.codigo && (
          <p id="codigo-setup-error" className="text-[12px] text-danger">
            {errors.codigo.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ShieldCheck className="h-4 w-4" />
        {isSubmitting ? 'Activando…' : 'Activar 2FA'}
      </button>
    </form>
  )
}

// ----------------------------------------------------------------------
// Modal: mostrar backup codes con opción de imprimir / copiar / descargar
// ----------------------------------------------------------------------

function ModalBackupCodes({ codes, onClose, descripcion }) {
  const [copiado, setCopiado] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  // ref + cleanup para evitar setState en unmount.
  const copiadoTimerRef = useRef(null)
  useEffect(() => () => {
    if (copiadoTimerRef.current) clearTimeout(copiadoTimerRef.current)
  }, [])

  const copiarTodos = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopiado(true)
      if (copiadoTimerRef.current) clearTimeout(copiadoTimerRef.current)
      copiadoTimerRef.current = setTimeout(() => {
        copiadoTimerRef.current = null
        setCopiado(false)
      }, 2000)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  const imprimir = () => {
    // Imprime una ventana minimalista con solo los códigos. El usuario puede
    // usar "Guardar como PDF" del diálogo del sistema.
    const ventana = window.open('', '_blank', 'width=600,height=600')
    if (!ventana) {
      toast.error('Permite las ventanas emergentes para imprimir')
      return
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>AnimeShowdown — códigos de recuperación 2FA</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { font-size: 13px; color: #444; }
  ol { font-family: ui-monospace, Menlo, monospace; font-size: 16px; line-height: 1.8; }
  li { letter-spacing: 0.15em; }
  .warn { margin-top: 30px; padding: 12px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; font-size: 12px; color: #7c2d12; }
</style></head><body>
<h1>AnimeShowdown — Códigos de recuperación 2FA</h1>
<p>Generados el ${new Date().toLocaleString()}.</p>
<ol>${codes.map((c) => `<li>${c}</li>`).join('')}</ol>
<div class="warn">
  Cada código solo sirve una vez. Guárdalos en un lugar seguro (gestor de contraseñas, caja fuerte…). No los compartas con nadie.
</div>
</body></html>`
    ventana.document.write(html)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 250)
  }

  return (
    <ModalShell
      onClose={() => confirmado && onClose()}
      title="Códigos de recuperación"
      icon={ShieldCheck}
      wide
    >
      <p className="mb-4 text-[13px] text-fg-muted">{descripcion}</p>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-success/20 bg-success/5 p-4 font-mono text-[14px] text-fg-strong">
        {codes.map((c, i) => (
          <div key={i} className="select-all">
            {c}
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copiarTodos}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3.5 py-2 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
        >
          {copiado ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copiado ? 'Copiado' : 'Copiar todos'}
        </button>
        <button
          type="button"
          onClick={imprimir}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3.5 py-2 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimir / Guardar PDF
        </button>
      </div>

      <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-bg p-3 text-[13px] text-fg-strong">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(e) => setConfirmado(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          He guardado mis códigos en un lugar seguro. Entiendo que sin ellos no
          podré entrar si pierdo mi dispositivo authenticator.
        </span>
      </label>

      <button
        type="button"
        onClick={onClose}
        disabled={!confirmado}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continuar
      </button>
    </ModalShell>
  )
}

// ----------------------------------------------------------------------
// Modal: desactivar 2FA (password + código)
// ----------------------------------------------------------------------

function Modal2faDisable({ onClose, onSuccess }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    try {
      const codigo = (data.codigo || '').replace(/\s+/g, '')
      await endpoints.disable2fa(data.password, codigo)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const msg = err.message || ''
        if (msg.toLowerCase().includes('contraseña')) {
          setError('password', { message: msg })
        } else {
          setError('codigo', { message: msg })
        }
      } else {
        setError('root', {
          message:
            err instanceof ApiError
              ? err.message || `Error ${err.status}`
              : 'No se pudo conectar al servidor.',
        })
      }
    }
  }

  return (
    <ModalShell onClose={onClose} title="Desactivar 2FA" icon={ShieldOff}>
      <p className="mb-4 text-[13px] text-fg-muted">
        Confirma tu contraseña actual y un código de la app authenticator para
        desactivar la verificación en dos pasos. Tus códigos de recuperación
        también se eliminarán.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="disable-password"
            className="text-[13px] font-medium text-fg-strong"
          >
            Contraseña actual
          </label>
          <PasswordInput
            id="disable-password"
            autoComplete="current-password"
            error={Boolean(errors.password)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? 'disable-password-error' : undefined
            }
            {...register('password', { required: 'Introduce tu contraseña' })}
          />
          {errors.password && (
            <p id="disable-password-error" className="text-[11px] text-danger">
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="disable-codigo"
            className="text-[13px] font-medium text-fg-strong"
          >
            Código de 6 dígitos
          </label>
          <input
            id="disable-codigo"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={6}
            aria-invalid={Boolean(errors.codigo)}
            aria-describedby={
              errors.codigo ? 'disable-codigo-error' : undefined
            }
            {...register('codigo', {
              required: 'Introduce el código',
              pattern: { value: /^\d{6}$/, message: 'Deben ser 6 dígitos' },
            })}
            className={`rounded-lg border bg-bg px-3.5 py-2.5 text-center font-mono text-xl text-fg-strong focus:outline-none focus:ring-2 focus:ring-gold ${
              errors.codigo ? 'border-danger' : 'border-border'
            }`}
            placeholder="123456"
          />
          {errors.codigo && (
            <p id="disable-codigo-error" className="text-[11px] text-danger">
              {errors.codigo.message}
            </p>
          )}
        </div>
        {errors.root && (
          <p role="alert" className="text-[11px] text-danger">
            {errors.root.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-5 py-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldOff className="h-4 w-4" />
          {isSubmitting ? 'Desactivando…' : 'Desactivar 2FA'}
        </button>
      </form>
    </ModalShell>
  )
}

// ----------------------------------------------------------------------
// Modal: regenerar backup codes (pide TOTP code para confirmar)
// ----------------------------------------------------------------------

function Modal2faRegenerate({ onClose }) {
  // Pasos: 'codigo' → 'backupCodes'
  const [nuevos, setNuevos] = useState(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (data) => {
    try {
      const codigo = (data.codigo || '').replace(/\s+/g, '')
      const res = await endpoints.regenerateBackupCodes(codigo)
      setNuevos(res.backupCodes)
    } catch (err) {
      setError('codigo', {
        message:
          err instanceof ApiError
            ? err.message || `Error ${err.status}`
            : 'No se pudo conectar al servidor.',
      })
    }
  }

  if (nuevos) {
    return (
      <ModalBackupCodes
        codes={nuevos}
        onClose={onClose}
        descripcion="Los códigos anteriores ya no funcionan. Guarda estos 10 nuevos en un lugar seguro."
      />
    )
  }

  return (
    <ModalShell
      onClose={onClose}
      title="Regenerar códigos de recuperación"
      icon={RefreshCw}
    >
      <p className="mb-4 text-[13px] text-fg-muted">
        Genera un nuevo set de 10 códigos de recuperación.{' '}
        <strong>Los anteriores quedarán inservibles</strong>. Confirma con un
        código de tu app authenticator.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="regen-codigo"
            className="text-[13px] font-medium text-fg-strong"
          >
            Código de 6 dígitos
          </label>
          <input
            id="regen-codigo"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            autoComplete="one-time-code"
            maxLength={6}
            aria-invalid={Boolean(errors.codigo)}
            aria-describedby={errors.codigo ? 'regen-codigo-error' : undefined}
            {...register('codigo', {
              required: 'Introduce el código',
              pattern: { value: /^\d{6}$/, message: 'Deben ser 6 dígitos' },
            })}
            className={`rounded-lg border bg-bg px-3.5 py-2.5 text-center font-mono text-xl text-fg-strong focus:outline-none focus:ring-2 focus:ring-gold ${
              errors.codigo ? 'border-danger' : 'border-border'
            }`}
            placeholder="123456"
          />
          {errors.codigo && (
            <p id="regen-codigo-error" className="text-[11px] text-danger">
              {errors.codigo.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" />
          {isSubmitting ? 'Regenerando…' : 'Regenerar códigos'}
        </button>
      </form>
    </ModalShell>
  )
}

export default Card2faSeguridad
