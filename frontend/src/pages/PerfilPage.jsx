import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ImagePlus,
  Key,
  Link as LinkIcon,
  LogOut,
  Mail,
  Shield,
  Upload,
  User,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { endpoints, ApiError } from '../lib/api'
import Avatar from '../components/Avatar'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

async function fileToBase64(file, maxSize = 256, quality = 0.82) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

function PerfilPage() {
  useDocumentTitle('Mi perfil')
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return <Navigate to="/login" replace />

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            Mi cuenta
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Perfil
          </h1>
          <p className="text-fg-muted">
            Gestiona tus datos, tu avatar y la seguridad de tu cuenta.
          </p>
        </motion.header>

        <div className="grid gap-6">
          <CardDatos user={user} />
          <CardAvatar user={user} updateUser={updateUser} />
          <CardPassword />
          <CardSesion onLogout={handleLogout} />
        </div>
      </div>
    </section>
  )
}

function CardDatos({ user }) {
  return (
    <div className="flex items-center gap-5 rounded-xl border border-border bg-surface p-6">
      <Avatar user={user} size={80} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xl font-bold tracking-tight text-fg-strong">
          {user.username}
        </p>
        <p className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
          <Mail className="h-3.5 w-3.5" />
          {user.email || 'sin email'}
        </p>
        <p className="inline-flex items-center gap-1.5 text-[12px]">
          <User className="h-3.5 w-3.5 text-fg-muted" />
          <span
            className={`font-mono font-bold ${
              user.rol === 'ADMIN' ? 'text-accent' : 'text-fg-muted'
            }`}
          >
            {user.rol || 'USER'}
          </span>
          {user.rol === 'ADMIN' && (
            <Shield className="h-3 w-3 text-accent" />
          )}
        </p>
      </div>
    </div>
  )
}

function CardAvatar({ user, updateUser }) {
  const [tab, setTab] = useState('archivo')
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-fg-strong">Foto de perfil</h2>
        <p className="text-[12px] text-fg-muted">
          Sube una imagen desde tu equipo o pega una URL pública. Si lo dejas vacío, se usa el avatar generado de iniciales.
        </p>
      </div>
      <div className="mb-5 flex items-center gap-4">
        <Avatar user={user} size={72} />
        <p className="text-[13px] text-fg-muted">Avatar actual</p>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg p-1">
        <button
          type="button"
          onClick={() => setTab('archivo')}
          className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
            tab === 'archivo'
              ? 'bg-surface-alt text-fg-strong'
              : 'text-fg-muted hover:text-fg-strong'
          }`}
        >
          <Upload className="h-4 w-4" />
          Subir archivo
        </button>
        <button
          type="button"
          onClick={() => setTab('url')}
          className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
            tab === 'url'
              ? 'bg-surface-alt text-fg-strong'
              : 'text-fg-muted hover:text-fg-strong'
          }`}
        >
          <LinkIcon className="h-4 w-4" />
          Pegar URL
        </button>
      </div>
      {tab === 'archivo' ? (
        <UploadForm user={user} updateUser={updateUser} />
      ) : (
        <UrlForm user={user} updateUser={updateUser} />
      )}
    </div>
  )
}

function UploadForm({ user, updateUser }) {
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const procesar = async (file) => {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Tiene que ser una imagen (PNG, JPG, WebP, GIF…).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagen demasiado grande (máx 5 MB).')
      return
    }
    try {
      setBusy(true)
      const base64 = await fileToBase64(file, 256, 0.82)
      setPreview(base64)
    } catch {
      setError('No se pudo procesar la imagen.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubir = async () => {
    if (!preview) return
    setError(null)
    try {
      setBusy(true)
      await endpoints.updateAvatar(preview)
      updateUser({ avatarUrl: preview })
      toast.success('Avatar actualizado', {
        description: 'Imagen subida correctamente.',
      })
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status} · ${err.message || 'sin detalle del servidor'}`
          : 'No se pudo conectar al servidor.'
      setError(msg)
      toast.error('Error subiendo avatar', {
        description:
          err instanceof ApiError && err.status === 500
            ? 'Suele ser que la columna avatar_url aún es VARCHAR(500). Corre el ALTER TABLE en Neon.'
            : msg,
      })
    } finally {
      setBusy(false)
    }
  }

  const handleQuitar = async () => {
    setError(null)
    try {
      setBusy(true)
      await endpoints.updateAvatar(null)
      updateUser({ avatarUrl: null })
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      toast.success('Avatar quitado', {
        description: 'Volviste al avatar generado de iniciales.',
      })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      setError(msg)
      toast.error('Error quitando avatar', { description: msg })
    } finally {
      setBusy(false)
    }
  }

  const tamañoKB = preview
    ? Math.round((preview.length * 0.75) / 1024)
    : 0

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={(e) => procesar(e.target.files?.[0])}
        className="hidden"
      />
      {!preview ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-bg px-5 py-10 text-fg-muted transition-colors hover:border-accent/40 hover:text-fg-strong"
        >
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm font-semibold">
            Arrastra o pulsa para elegir
          </span>
          <span className="text-[11px]">
            PNG, JPG, WebP — máx 5 MB · se redimensiona a 256×256 al subir
          </span>
        </button>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-bg p-4">
          <div className="flex w-full items-center gap-4">
            <img
              src={preview}
              alt="Vista previa"
              className="h-20 w-20 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-fg-strong">
                Vista previa lista
              </p>
              <p className="text-[11px] text-fg-muted">
                JPEG 256×256 · {tamañoKB} KB aprox
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
              className="text-[12px] text-fg-muted transition-colors hover:text-accent"
            >
              Cancelar
            </button>
          </div>
          <button
            type="button"
            onClick={handleSubir}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {busy ? 'Subiendo…' : 'Subir avatar'}
          </button>
        </div>
      )}
      {user.avatarUrl && (
        <button
          type="button"
          onClick={handleQuitar}
          disabled={busy}
          className="self-start text-[12px] text-fg-muted transition-colors hover:text-accent disabled:opacity-60"
        >
          Quitar avatar actual
        </button>
      )}
      {error && <p className="text-[12px] text-red-400">{error}</p>}
    </div>
  )
}

function UrlForm({ user, updateUser }) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      avatarUrl:
        user.avatarUrl && user.avatarUrl.startsWith('http')
          ? user.avatarUrl
          : '',
    },
  })
  const [error, setError] = useState(null)
  const previewUrl = watch('avatarUrl')

  const onSubmit = async (data) => {
    setError(null)
    try {
      const url = data.avatarUrl?.trim() || null
      await endpoints.updateAvatar(url)
      updateUser({ avatarUrl: url })
      toast.success('Avatar actualizado', {
        description: url
          ? 'URL guardada.'
          : 'Volviste al avatar generado.',
      })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      setError(msg)
      toast.error('No se pudo guardar', { description: msg })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-lg border border-border bg-bg p-3">
        {previewUrl?.trim() ? (
          <img
            src={previewUrl.trim()}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.style.opacity = 0.3
            }}
          />
        ) : (
          <Avatar user={user} size={48} />
        )}
        <p className="text-[12px] text-fg-muted">Vista previa</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="avatarUrl"
          className="text-[12px] font-medium text-fg-strong"
        >
          URL de la imagen
        </label>
        <input
          id="avatarUrl"
          type="url"
          {...register('avatarUrl', {
            pattern: {
              value: /^$|^https?:\/\/.+/,
              message: 'Debe empezar por http:// o https://',
            },
            maxLength: { value: 2000, message: 'URL demasiado larga' },
          })}
          placeholder="https://i.imgur.com/abc.jpg"
          className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
            errors.avatarUrl ? 'border-red-500' : 'border-border'
          }`}
        />
        {errors.avatarUrl && (
          <p className="text-[11px] text-red-400">
            {errors.avatarUrl.message}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LinkIcon className="h-4 w-4" />
        {isSubmitting ? 'Guardando…' : 'Guardar URL'}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </form>
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
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Key className="h-4 w-4 text-accent" />
        <h2 className="text-lg font-bold text-fg-strong">Cambiar contraseña</h2>
      </div>
      <p className="mb-5 text-[12px] text-fg-muted">
        Necesitas la contraseña actual para confirmar el cambio. Si no la recuerdas,
        usa el flujo de "Olvidé mi contraseña" desde el login.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="currentPassword"
            className="text-[12px] font-medium text-fg-strong"
          >
            Contraseña actual
          </label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            {...register('currentPassword', {
              required: 'Introduce tu contraseña actual',
            })}
            className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
              errors.currentPassword ? 'border-red-500' : 'border-border'
            }`}
            placeholder="Tu contraseña actual"
          />
          {errors.currentPassword && (
            <p className="text-[11px] text-red-400">
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
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register('newPassword', {
              required: 'Introduce la contraseña nueva',
              minLength: { value: 8, message: 'Mínimo 8 caracteres' },
              pattern: {
                value: /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/,
                message: 'Debe incluir al menos una letra y un número',
              },
            })}
            className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
              errors.newPassword ? 'border-red-500' : 'border-border'
            }`}
            placeholder="Mínimo 8, con letra y número"
          />
          {errors.newPassword && (
            <p className="text-[11px] text-red-400">
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
          <input
            id="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmNewPassword', {
              required: 'Confirma la contraseña nueva',
              validate: (v) =>
                v === newPassword || 'Las contraseñas no coinciden',
            })}
            className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
              errors.confirmNewPassword ? 'border-red-500' : 'border-border'
            }`}
            placeholder="Repite la nueva contraseña"
          />
          {errors.confirmNewPassword && (
            <p className="text-[11px] text-red-400">
              {errors.confirmNewPassword.message}
            </p>
          )}
        </div>
        {errors.root && (
          <p className="text-[12px] text-red-400">{errors.root.message}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Key className="h-4 w-4" />
          {isSubmitting ? 'Guardando…' : 'Cambiar contraseña'}
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
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6">
      <div className="mb-3 flex items-center gap-2">
        <LogOut className="h-4 w-4 text-rose-300" />
        <h2 className="text-lg font-bold text-fg-strong">Cerrar sesión</h2>
      </div>
      <p className="mb-4 text-[12px] text-fg-muted">
        Cierra tu sesión en este dispositivo. Tu token JWT se borra del navegador,
        tendrás que volver a entrar con tu username y contraseña.
      </p>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-500/20"
      >
        <LogOut className="h-4 w-4" />
        Salir de mi cuenta
      </button>
    </div>
  )
}

export default PerfilPage
