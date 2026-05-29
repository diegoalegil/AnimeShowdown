import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Key,
  LogOut,
  Trash2,
  User,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { useSeo } from '../hooks/useSeo'
import { endpoints, ApiError } from '../lib/api'
import Dialog from '../components/Dialog'
import Card2faSeguridad from '../components/Card2faSeguridad'
import CardActividadReciente from '../components/CardActividadReciente'
import CardDanKyu from '../components/CardDanKyu'
import CardLogros from '../components/CardLogros'
import CardMiRoster from '../components/CardMiRoster'
import CardMisTorneos from '../components/CardMisTorneos'
import CardReferral from '../components/CardReferral'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import PasswordInput from '../components/PasswordInput'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import CardAvatar from '../features/perfil/components/CardAvatar'
import CardUsername from '../features/perfil/components/CardUsername'
import CardDatosCuenta from '../features/perfil/components/CardDatosCuenta'
import PerfilQuickStats from '../features/perfil/components/PerfilQuickStats'
import PerfilTabs from '../features/perfil/components/PerfilTabs'
import { tabValida } from '../features/perfil/perfil-tabs'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function PerfilPage() {
  // noindex porque es vista privada del propio usuario — /u/{username}
  // es el perfil público que sí queremos indexar.
  useSeo({ title: 'Mi perfil', noindex: true })
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = tabValida(searchParams.get('tab'))

  if (!user) return <Navigate to="/login" replace />

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <VisualPageShell visual={BRAND_VISUALS.perfilHero} contentClassName="mx-auto max-w-3xl" density="low" lateralKanji={{left: "我", right: "道"}}>
      <motion.header
          className="mb-6 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-gold">
            <User className="h-3 w-3" />
            Mi cuenta · Tu espacio personal
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Mi perfil
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Revisa tu progreso, personaliza tu avatar y gestiona tu cuenta
            dentro de AnimeShowdown.
          </p>
        </motion.header>

        {/* Quick stats strip: 4 metricas grandes que cuentan tu progreso
            de un vistazo antes de los tabs. Antes habia que entrar en
            "Resumen" para ver Dan/Kyu, navegar a Logros para badges, etc.
            Ahora todo emerge inmediato al entrar al perfil. */}
        <PerfilQuickStats />

        {/* Tabs: separa la parte de gamificación (Resumen/Logros/Torneos)
            de la parte sensible (Ajustes). Antes todas las cards iban
            seguidas en un único scroll de ~3000px de alto. */}
        <PerfilTabs
          activeTab={tab}
          onChange={(nextTab) => {
            setSearchParams(nextTab === 'resumen' ? {} : { tab: nextTab }, {
              replace: true,
            })
          }}
        />

        <div
          id={`perfilpanel-${tab}`}
          role="tabpanel"
          aria-labelledby={`perfiltab-${tab}`}
          className="grid gap-6"
        >
          {tab === 'resumen' && (
            <>
              <CardDatosCuenta user={user} />
              <CardDanKyu />
              <CardReferral />
              <CardActividadReciente />
            </>
          )}
          {tab === 'roster' && <CardMiRoster />}
          {tab === 'logros' && <CardLogros />}
          {tab === 'torneos' && <CardMisTorneos />}
          {tab === 'ajustes' && (
            <>
              <CardUsername user={user} />
              <CardAvatar user={user} updateUser={updateUser} />
              <CardPassword />
              <Card2faSeguridad />
              <CardSesion onLogout={handleLogout} />
              <CardEliminarCuenta onEliminada={() => navigate('/')} />
            </>
          )}
        </div>
    </VisualPageShell>
  )
}

function CardPassword() {
  const { play } = useSound()
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()
  const newPassword = watch('newPassword')

  const onSubmit = async (data) => {
    try {
      await endpoints.changePassword(data.currentPassword, data.newPassword)
      play('playLevelUp')
      toast.success('Contraseña actualizada', {
        description: 'Tu nueva contraseña ya está activa.',
      })
      reset()
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      if (status === 401) {
        // current password mal
        setError('currentPassword', { message: 'La contraseña actual no coincide' })
      } else if (status === 400) {
        // nueva password incumple regla
        setError('newPassword', { message: msg })
      } else {
        setError('root', { message: msg })
      }
      toast.error('No se pudo cambiar la contraseña', { description: msg })
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Key className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">Cambia tu contraseña</h2>
      </div>
      <p className="mb-5 text-[12px] text-fg-muted">
        Introduce tu contraseña actual y elige una nueva. Usa al menos 8
        caracteres, incluyendo una letra y un número. Si no recuerdas la
        actual, usa "Olvidé mi contraseña" desde el login.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="currentPassword"
            className="text-[12px] font-medium text-fg-strong"
          >
            Contraseña actual
          </label>
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            error={Boolean(errors.currentPassword)}
            placeholder="Tu contraseña actual"
            {...register('currentPassword', {
              required: 'Introduce tu contraseña actual',
            })}
          />
          {errors.currentPassword && (
            <p className="text-[11px] text-danger">
              {errors.currentPassword.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="newPassword"
            className="text-[12px] font-medium text-fg-strong"
          >
            Nueva contraseña
          </label>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            error={Boolean(errors.newPassword)}
            placeholder="Mínimo 8, con letra y número"
            {...register('newPassword', {
              required: 'Introduce la contraseña nueva',
              minLength: { value: 8, message: 'Mínimo 8 caracteres' },
              pattern: {
                value: /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/,
                message: 'Debe incluir al menos una letra y un número',
              },
            })}
          />
          {errors.newPassword && (
            <p className="text-[11px] text-danger">
              {errors.newPassword.message}
            </p>
          )}
          <PasswordStrengthMeter password={newPassword} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirmNewPassword"
            className="text-[12px] font-medium text-fg-strong"
          >
            Confirma la nueva contraseña
          </label>
          <PasswordInput
            id="confirmNewPassword"
            autoComplete="new-password"
            error={Boolean(errors.confirmNewPassword)}
            placeholder="Repite la nueva contraseña"
            {...register('confirmNewPassword', {
              required: 'Confirma la contraseña nueva',
              validate: (v) =>
                v === newPassword || 'Las contraseñas no coinciden',
            })}
          />
          {errors.confirmNewPassword && (
            <p className="text-[11px] text-danger">
              {errors.confirmNewPassword.message}
            </p>
          )}
        </div>
        {errors.root && (
          <p role="alert" className="text-[12px] text-danger">{errors.root.message}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Key className="h-4 w-4" />
          {isSubmitting ? 'Guardando…' : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  )
}

function CardSesion({ onLogout }) {
  const { play } = useSound()
  const handleClick = () => {
    play('playClick')
    onLogout()
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4">
      <div className="flex items-center gap-3">
        <LogOut className="h-4 w-4 text-danger" />
        <div>
          <p className="text-sm font-bold text-fg-strong">Cerrar sesión</p>
          <p className="text-[11px] text-fg-muted">
            Cierra tu sesión en este dispositivo.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/20"
      >
        <LogOut className="h-3.5 w-3.5" />
        Salir de mi cuenta
      </button>
    </div>
  )
}

/**
 * Zona peligrosa del perfil.
 *
 * <p>Doble confirmación: abrir modal → marcar checkbox de "entiendo
 * que es irreversible" + escribir contraseña → confirmar. El backend
 * verifica la password una vez más antes de borrar.
 *
 * <p>Tras éxito: limpia el contexto de auth (logout local) y llama
 * onEliminada para redirigir. La cookie de refresh la limpia el
 * backend en la propia respuesta DELETE.
 */
function CardEliminarCuenta({ onEliminada }) {
  const { logout } = useAuth()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const [password, setPassword] = useState('')
  const [pendiente, setPendiente] = useState(false)
  const passwordValida = password.trim().length > 0
  const puedeEliminar = confirmado && passwordValida && !pendiente

  const reset = () => {
    setModalAbierto(false)
    setConfirmado(false)
    setPassword('')
  }

  const handleConfirmar = async () => {
    if (!puedeEliminar) return
    setPendiente(true)
    try {
      await endpoints.eliminarMiCuenta({ password })
      toast.success('Cuenta eliminada. Esperamos verte de vuelta.')
      logout()
      onEliminada?.()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.body?.message || err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      toast.error('No se pudo eliminar la cuenta', { description: msg })
    } finally {
      setPendiente(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-danger/30 bg-danger/[0.04] p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <h2 className="text-sm font-bold text-fg-strong">Zona peligrosa</h2>
        </div>
        <p className="mb-4 text-[12px] leading-relaxed text-fg-muted">
          Eliminar tu cuenta borra para siempre tus predicciones, logros,
          notificaciones, reacciones, follows y sesiones activas. Los votos
          que emitiste se conservan como anónimos para no romper el ranking
          de los personajes; los torneos que hayas creado seguirán existiendo
          sin tu nombre. No se puede deshacer.
        </p>
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-danger/50 bg-danger/10 px-4 py-2 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar mi cuenta
        </button>
      </div>

      {/* Dialog aporta focus trap, Escape, restore de foco y lock
          de scroll. Escape/backdrop se bloquean durante el borrado para no
          cancelar un proceso en curso por accidente. */}
      <Dialog
        open={modalAbierto}
        onClose={() => { if (!pendiente) reset() }}
        titleId="modal-eliminar-titulo"
        closeOnBackdrop={!pendiente}
        closeOnEscape={!pendiente}
        panelClassName="border-danger/40 max-w-md"
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <h3
            id="modal-eliminar-titulo"
            className="text-base font-bold text-fg-strong"
          >
            Eliminar tu cuenta para siempre
          </h3>
        </div>
        <p className="mb-5 text-[13px] leading-relaxed text-fg-muted">
          Esta acción es irreversible. Tu username y email quedarán
          libres para registrarse de nuevo, pero los datos asociados
          se borran o se anonimizan en cuanto pulses Confirmar.
        </p>

        <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-bg p-3">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            disabled={pendiente}
            className="mt-0.5 accent-danger"
          />
          <span className="text-[12px] leading-relaxed text-fg-muted">
            Entiendo que la acción es irreversible y que perderé
            predicciones, logros y follows. Mis votos quedarán anónimos.
          </span>
        </label>

        <label
          htmlFor="modal-eliminar-password"
          className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-fg-muted"
        >
          Confirma tu contraseña
        </label>
        <div className="mb-5">
          <PasswordInput
            id="modal-eliminar-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pendiente}
            placeholder="••••••••"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={pendiente}
            className="rounded-lg border border-border bg-bg px-4 py-2 text-[13px] font-semibold text-fg-strong transition-colors hover:border-accent/40 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!puedeEliminar}
            className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-danger disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {pendiente ? 'Eliminando…' : 'Confirmar eliminación'}
          </button>
        </div>
      </Dialog>
    </>
  )
}

export default PerfilPage
