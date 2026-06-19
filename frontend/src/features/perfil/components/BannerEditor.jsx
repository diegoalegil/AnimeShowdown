import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ImagePlus, Layers, Link as LinkIcon, Search, Swords, Tv, Upload } from 'lucide-react'
import { toast } from 'sonner'
import ProfileBanner from '../../../components/ProfileBanner'
import PersonajeImg from '../../../components/PersonajeImg'
import { endpoints, ApiError } from '../../../lib/api'
import { usePersonajesCatalogo } from '../../../hooks/usePersonajesCatalogo'
import { ANIME_VISUALS, TOURNAMENT_VISUALS } from '../../../data/visual-assets'

const TAB_META = {
  archivo: { label: 'Subir', icon: Upload },
  catalogo: { label: 'Cartas', icon: Layers },
  animes: { label: 'Animes', icon: Tv },
  torneos: { label: 'Torneos', icon: Swords },
  url: { label: 'URL', icon: LinkIcon },
}

// Banners horizontales (16:9) del catálogo: key visuals de animes y de torneos.
// A diferencia de las cards de personaje (verticales 2:3), encajan en la
// cabecera sin recorte raro; un banner horizontal no debe depender de arte
// vertical pensado para cartas.
const ANIME_BANNERS = Object.values(ANIME_VISUALS)
const TORNEO_BANNERS = Object.values(TOURNAMENT_VISUALS)

const CATALOGO_VISIBLE_MAX = 48

// Ratio del banner: 1200×400 (3:1). Recorte "cover" centrado para que la
// imagen llene la franja sin deformarse; JPEG q0.82 deja el peso muy por
// debajo del límite de 2 MB del backend.
const BANNER_W = 1200
const BANNER_H = 400

async function fileToBannerBase64(file, targetW = BANNER_W, targetH = BANNER_H, quality = 0.82) {
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
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  const scale = Math.max(targetW / img.width, targetH / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (targetW - w) / 2, (targetH - h) / 2, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Selector de banner del perfil (V35). Clona el flujo del avatar (foto propia
 * primero, card del catálogo, URL avanzada) pero recorta a ratio banner y
 * persiste vía PUT /me/banner. El caller decide qué tabs mostrar.
 */
function BannerEditor({ user, updateUser, tabs = ['archivo', 'catalogo', 'animes', 'torneos', 'url'] }) {
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
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-fg-muted">Banner actual</p>
        <ProfileBanner
          bannerUrl={user.bannerUrl}
          fallbackImagenUrl={user.favoritoImagenUrl}
          alt="Banner actual"
          className="h-24 rounded-lg border border-border sm:h-28"
        />
        {!user.bannerUrl && (
          <p className="text-[11px] text-fg-muted">
            Sin banner propio: se muestra el arte de tu personaje favorito.
          </p>
        )}
      </div>
      <div
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-bg p-1"
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
              id={`bannertab-${id}`}
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`inline-flex min-w-[84px] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
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
      {tab === 'animes' && (
        <VisualesForm items={ANIME_BANNERS} updateUser={updateUser} etiqueta="anime" />
      )}
      {tab === 'torneos' && (
        <VisualesForm items={TORNEO_BANNERS} updateUser={updateUser} etiqueta="torneo" />
      )}
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
    if (file.size > 10 * 1024 * 1024) {
      setError('Imagen demasiado grande (máx 10 MB).')
      return
    }
    try {
      setBusy(true)
      const base64 = await fileToBannerBase64(file)
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
      await endpoints.updateBanner(preview)
      updateUser({ bannerUrl: preview })
      toast.success('Banner actualizado', {
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
      toast.error('Error subiendo banner', {
        description:
          err instanceof ApiError && err.status === 500
            ? 'No pudimos guardar el banner ahora mismo. Inténtalo de nuevo en unos minutos.'
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
      await endpoints.updateBanner(null)
      updateUser({ bannerUrl: null })
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      toast.success('Banner quitado', {
        description: 'Volviste al arte de tu personaje favorito.',
      })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      setError(msg)
      toast.error('Error quitando banner', { description: msg })
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
            PNG, JPG, WebP — máx 10 MB · se recorta a {BANNER_W}×{BANNER_H} al subir
          </span>
        </button>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-bg p-4">
          <img
            src={preview}
            alt="Vista previa del banner"
            className="aspect-[3/1] w-full rounded-lg object-cover"
          />
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-[11px] text-fg-muted">
              JPEG {BANNER_W}×{BANNER_H} · {tamañoKB} KB aprox
            </p>
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
            {busy ? 'Subiendo…' : 'Subir banner'}
          </button>
        </div>
      )}
      {user.bannerUrl && (
        <button
          type="button"
          onClick={handleQuitar}
          disabled={busy}
          className="self-start text-[12px] text-fg-muted transition-colors hover:text-gold disabled:opacity-60"
        >
          Quitar banner actual
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
      await endpoints.updateBanner(absoluta)
      updateUser({ bannerUrl: absoluta })
      toast.success('Banner actualizado', {
        description: `Tu cabecera ahora luce a ${p.nombre}.`,
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
        Elige una card del catálogo como cabecera. Busca para ver más allá de
        los primeros {CATALOGO_VISIBLE_MAX}.
      </p>
    </div>
  )
}

function VisualesForm({ items, updateUser, etiqueta }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(null)

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = term
      ? items.filter((v) => v.title?.toLowerCase().includes(term))
      : items
    return base.slice(0, CATALOGO_VISIBLE_MAX)
  }, [items, q])

  const elegir = async (v) => {
    if (!v?.image) return
    const absoluta = new URL(v.image, window.location.origin).href
    setBusy(v.slug)
    try {
      await endpoints.updateBanner(absoluta)
      updateUser({ bannerUrl: absoluta })
      toast.success('Banner actualizado', {
        description: `Tu cabecera ahora luce ${v.title}.`,
      })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      toast.error('No se pudo usar ese banner', { description: msg })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Busca un ${etiqueta}…`}
          className="w-full rounded-lg border border-border bg-bg py-2.5 pl-9 pr-3 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      {filtrados.length === 0 ? (
        <p className="px-1 py-6 text-center text-[12px] text-fg-muted">
          Sin resultados. Prueba con otro nombre.
        </p>
      ) : (
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {filtrados.map((v) => (
            <button
              key={v.slug}
              type="button"
              onClick={() => elegir(v)}
              disabled={busy === v.slug}
              title={v.title}
              className="group relative aspect-[16/9] overflow-hidden rounded-lg border border-border bg-surface-alt transition-colors hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50"
            >
              <img
                src={v.image}
                alt={v.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pb-1 pt-4 text-left text-[10px] font-bold text-white">
                {v.title}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-fg-muted">
        Banners horizontales (16:9) del catálogo, pensados para la cabecera.
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
      bannerUrl:
        user.bannerUrl && user.bannerUrl.startsWith('http') ? user.bannerUrl : '',
    },
  })
  const [error, setError] = useState(null)
  const previewUrl = watch('bannerUrl')

  const onSubmit = async (data) => {
    setError(null)
    try {
      const url = data.bannerUrl?.trim() || null
      await endpoints.updateBanner(url)
      updateUser({ bannerUrl: url })
      toast.success('Banner actualizado', {
        description: url ? 'URL guardada.' : 'Volviste al arte de tu favorito.',
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
      <ProfileBanner
        bannerUrl={previewUrl?.trim() || user.bannerUrl}
        fallbackImagenUrl={user.favoritoImagenUrl}
        alt="Vista previa del banner"
        className="h-24 rounded-lg border border-border sm:h-28"
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bannerUrl" className="text-[12px] font-medium text-fg-strong">
          URL de la imagen
        </label>
        <input
          id="bannerUrl"
          type="url"
          {...register('bannerUrl', {
            pattern: {
              value: /^$|^https?:\/\/.+/,
              message: 'Debe empezar por http:// o https://',
            },
            maxLength: { value: 2000, message: 'URL demasiado larga' },
          })}
          placeholder="https://i.imgur.com/abc.jpg"
          className={`rounded-lg border bg-bg px-3.5 py-2.5 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
            errors.bannerUrl ? 'border-danger' : 'border-border'
          }`}
        />
        {errors.bannerUrl && (
          <p className="text-[11px] text-danger">{errors.bannerUrl.message}</p>
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

export default BannerEditor
