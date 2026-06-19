import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ImagePlus, Layers, Link as LinkIcon, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import Avatar from '../../../components/Avatar'
import PersonajeImg from '../../../components/PersonajeImg'
import { endpoints, ApiError } from '../../../lib/api'
import { usePersonajesCatalogo } from '../../../hooks/usePersonajesCatalogo'

const TAB_META = {
  archivo: { label: 'Subir foto', icon: Upload },
  catalogo: { label: 'Del catálogo', icon: Layers },
  url: { label: 'Pegar URL', icon: LinkIcon },
}

const CATALOGO_VISIBLE_MAX = 48

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

/**
 * V-8: selector de avatar reutilizable. Foto propia primero, card del catálogo
 * segundo (orden pedido en el brief) y URL como opción avanzada. El caller
 * decide qué tabs mostrar (el onboarding omite "url").
 */
function AvatarEditor({ user, updateUser, tabs = ['archivo', 'catalogo', 'url'] }) {
  const [tab, setTab] = useState(tabs[0])
  const tabRefs = useRef([])

  // Roving tabindex + flechas (patrón APG de PerfilTabs).
  const handleKeyDown = (e, idx) => {
    const n = tabs.length
    let next
    if (e.key === 'ArrowRight') next = (idx + 1) % n
    else if (e.key === 'ArrowLeft') next = (idx - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else return
    e.preventDefault()
    setTab(tabs[next])
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar user={user} size={64} />
        <p className="text-[13px] text-fg-muted">Avatar actual</p>
      </div>
      <div
        className={`grid gap-1 rounded-lg border border-border bg-bg p-1`}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        role="tablist"
      >
        {tabs.map((id, idx) => {
          const meta = TAB_META[id]
          const Icon = meta.icon
          return (
            <button
              key={id}
              ref={(el) => { tabRefs.current[idx] = el }}
              type="button"
              role="tab"
              id={`avatartab-${id}`}
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                tab === id
                  ? 'bg-surface-alt text-fg-strong'
                  : 'text-fg-muted hover:text-fg-strong'
              }`}
            >
              <Icon className="h-4 w-4" />
              {meta.label}
            </button>
          )
        })}
      </div>
      {tab === 'archivo' && <UploadForm user={user} updateUser={updateUser} />}
      {tab === 'catalogo' && <CatalogoForm updateUser={updateUser} />}
      {tab === 'url' && <UrlForm user={user} updateUser={updateUser} />}
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
            ? 'No pudimos guardar el avatar ahora mismo. Inténtalo de nuevo en unos minutos.'
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

  const tamañoKB = preview ? Math.round((preview.length * 0.75) / 1024) : 0

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
          <span className="text-sm font-semibold">Pulsa para elegir imagen</span>
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
              width={80}
              height={80}
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
              className="text-[12px] text-fg-muted transition-colors hover:text-gold"
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
          className="self-start text-[12px] text-fg-muted transition-colors hover:text-gold disabled:opacity-60"
        >
          Quitar avatar actual
        </button>
      )}
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  )
}

function CatalogoForm({ updateUser }) {
  const { personajes, isPending, isError, refetch } = usePersonajesCatalogo()
  const [q, setQ] = useState('')
  const [busySlug, setBusySlug] = useState(null)

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = term
      ? personajes.filter(
          (p) =>
            p.nombre?.toLowerCase().includes(term) ||
            p.anime?.toLowerCase().includes(term),
        )
      : personajes
    return base.slice(0, CATALOGO_VISIBLE_MAX)
  }, [personajes, q])

  const elegir = async (p) => {
    if (!p?.imagenUrl) return
    const absoluta = new URL(p.imagenUrl, window.location.origin).href
    setBusySlug(p.slug)
    try {
      await endpoints.updateAvatar(absoluta)
      updateUser({ avatarUrl: absoluta })
      toast.success('Avatar actualizado', {
        description: `Ahora luces a ${p.nombre}.`,
      })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      toast.error('No se pudo usar esa card', { description: msg })
    } finally {
      setBusySlug(null)
    }
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-bg p-4">
        <p className="text-[12px] text-fg-muted">
          No pudimos cargar el catálogo de personajes.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca un personaje o anime…"
          className="w-full rounded-lg border border-border bg-bg py-2.5 pl-9 pr-3 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      {isPending ? (
        <p className="px-1 py-6 text-center text-[12px] text-fg-muted">
          Cargando el roster…
        </p>
      ) : filtrados.length === 0 ? (
        <p className="px-1 py-6 text-center text-[12px] text-fg-muted">
          Sin resultados. Prueba con otro nombre.
        </p>
      ) : (
        <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
          {filtrados.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => elegir(p)}
              disabled={busySlug === p.slug}
              title={`${p.nombre} · ${p.anime}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-alt transition-colors hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50"
            >
              <PersonajeImg
                slug={p.slug}
                nombre={p.nombre}
                className="h-full w-full"
                width={96}
                height={96}
                sizes="96px"
              />
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-fg-muted">
        Elige una card del catálogo como foto de perfil. Busca para ver más allá
        de los primeros {CATALOGO_VISIBLE_MAX}.
      </p>
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
        description: url ? 'URL guardada.' : 'Volviste al avatar generado.',
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
        <Avatar
          user={
            previewUrl?.trim() ? { ...user, avatarUrl: previewUrl.trim() } : user
          }
          size={48}
        />
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
            errors.avatarUrl ? 'border-danger' : 'border-border'
          }`}
        />
        {errors.avatarUrl && (
          <p className="text-[11px] text-danger">{errors.avatarUrl.message}</p>
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
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </form>
  )
}

export default AvatarEditor
