import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Download, Image as ImageIcon, Plus, Share2, Sparkles, X } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import AutocompletePersonaje from '../components/AutocompletePersonaje'
import { imagenPersonaje } from '../lib/personajes-core'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import PersonajeImg from '../components/PersonajeImg'
import { recordDailyShare } from '../lib/dailyProgress'
import { shareOrCopy } from '../lib/share'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const SLOTS = 5
const STORAGE_KEY = 'animeshowdown.mitop5.v1'

/**
 * Sugerencias rápidas para arrancar — 8 personajes muy reconocidos del
 * catálogo. Si alguno no existe (catálogo evoluciona), filtramos.
 * Nota de producto: los slots vacíos enormes en móvil
 * parecían herramienta rota. Añadir "Empieza con tu favorito" + chips
 * de personajes top reduce la fricción de la primera selección.
 */
const SUGERENCIAS_RAPIDAS_SLUGS = [
  'luffy', 'naruto_uzumaki', 'satoru_gojo', 'son_goku',
  'levi_ackerman', 'roronoa_zoro', 'tanjiro_kamado', 'eren_yeager',
]

/**
 * Generador "Mi Top 5" — el usuario elige 5 personajes
 * favoritos del catálogo y exporta una imagen 1200×630 lista para
 * Twitter/Discord/Instagram con su selección.
 *
 * <p>Renderiza un canvas server-side-style en cliente con:
 * - Fondo dark con aurora magenta blur (consistente con el sitio).
 * - Logo AnimeShowdown arriba izq.
 * - Título "Mi Top 5 anime".
 * - Grid horizontal de las 5 cards con avatar + nombre + anime.
 * - Watermark animeshowdown.dev abajo derecha.
 *
 * <p>Sin backend, sin OG image dinámica — todo client-side con canvas.
 * Las imágenes del catálogo se descargan con crossOrigin para que canvas
 * permita exportar sin "tainted canvas" error. Si alguna falla (imagen
 * privada no permitida), usamos placeholder color.
 *
 * <p>Persistencia: el set elegido queda en localStorage para que el user
 * pueda volver a la página y seguir editando sin perder lo que hizo.
 */
function MiTop5Page() {
  useSeo({
    title: 'Mi Top 5 — Generador',
    description:
      'Elige tus 5 personajes anime favoritos y exporta una imagen 1200×630 lista para compartir en Twitter, Discord o Instagram.',
  })
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const personajesBySlug = useMemo(
    () => new Map(catalogoPersonajes.map((p) => [p.slug, p])),
    [catalogoPersonajes],
  )

  const [slots, setSlots] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return Array(SLOTS).fill(null)
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return Array(SLOTS).fill(null)
      return parsed
          .slice(0, SLOTS)
          .concat(Array(SLOTS).fill(null))
          .slice(0, SLOTS)
    } catch {
      return Array(SLOTS).fill(null)
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slots))
    } catch {
      // ignore
    }
  }, [slots])

  const setSlot = (idx, slug) => {
    setSlots((s) => {
      const next = [...s]
      next[idx] = slug
      return next
    })
  }

  const quitarSlot = (idx) => setSlot(idx, null)

  const completo = slots.every(Boolean)
  const slotsVacios = slots.filter((s) => !s).length

  // Sugerencias = top slugs que aún no están en el top del user
  const sugerenciasDisponibles = useMemo(() => {
    return SUGERENCIAS_RAPIDAS_SLUGS
      .map((slug) => personajesBySlug.get(slug))
      .filter((p) => p && !slots.includes(p.slug))
      .slice(0, 6)
  }, [personajesBySlug, slots])

  const addSlugAlPrimerSlotLibre = (slug) => {
    const idx = slots.findIndex((s) => !s)
    if (idx === -1) {
      toast.info('Top 5 completo. Quita uno para añadir otro.')
      return
    }
    if (slots.includes(slug)) {
      toast.info('Ese personaje ya está en tu top.')
      return
    }
    setSlot(idx, slug)
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Mi Top 5', path: '/mi-top5' },
        ])}
      />
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-gold">
            <ImageIcon className="h-3 w-3" />
            Mi Top 5
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Tu top 5 anime, imagen lista para share
          </h1>
          <p className="text-[13px] text-fg-muted">
            Elige los 5 personajes que mejor te representan. Cuando esté listo,
            descarga la imagen 1200×630 y compártela en Twitter/Discord/
            Instagram con #AnimeShowdown.
          </p>
        </motion.header>

        {/* Nota de producto: antes los slots usaban grid 1-col
            en mobile → cada uno aspect-2/3 full-width = ~580px de alto
            vacío. Cambio a grid-cols-5 en TODAS las viewports con tamaño
            compacto que se escala con sm:; los slots vacíos quedan
            pequeños y el resto de la página (buscador + sugerencias)
            entra dentro del primer viewport. */}
        <div className="mb-5 grid grid-cols-5 gap-2 sm:mb-8 sm:gap-4">
          {slots.map((slug, i) => (
            <Slot
              key={i}
              slug={slug}
              personaje={slug ? personajesBySlug.get(slug) : null}
              index={i}
              onQuitar={() => quitarSlot(i)}
            />
          ))}
        </div>

        {/* Sugerencias rápidas — solo cuando hay slots vacíos */}
        {slotsVacios > 0 && sugerenciasDisponibles.length > 0 && (
          <div className="mb-5 rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <p className="text-[13px] font-semibold text-fg-strong">
                Empieza con tu favorito
              </p>
              <span className="text-[11px] text-fg-muted">
                ({slotsVacios} {slotsVacios === 1 ? 'slot libre' : 'slots libres'})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sugerenciasDisponibles.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => addSlugAlPrimerSlotLibre(p.slug)}
                  className="group inline-flex items-center gap-2 rounded-full border border-border bg-bg px-2 py-1 text-[12px] font-medium text-fg-strong transition-colors hover:border-accent hover:text-gold"
                >
                  <PersonajeImg
                    slug={p.slug}
                    src={p.imagenUrl ?? p.imagen}
                    alt={p.nombre}
                    loading="lazy"
                    className="h-5 w-5 rounded-full object-cover object-top"
                  />
                  {p.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6 rounded-xl border border-border bg-surface p-4 sm:p-5">
          <p className="mb-3 text-[13px] font-semibold text-fg-strong">
            O busca cualquier personaje del catálogo
          </p>
          <AutocompletePersonaje
            onSelect={addSlugAlPrimerSlotLibre}
            placeholder="Busca y selecciona…"
            filtroExtra={(p) => !slots.includes(p.slug)}
          />
        </div>

        <CanvasPreview
          slots={slots}
          completo={completo}
          personajesBySlug={personajesBySlug}
        />
      </div>
    </section>
  )
}

function Slot({ slug, personaje, index, onQuitar }) {
  if (!slug) {
    return (
      <div className="flex aspect-[2/3] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-bg/30 text-fg-muted sm:gap-2 sm:rounded-xl">
        <Plus className="h-4 w-4 sm:h-6 sm:w-6" />
        <span className="text-[10px] font-semibold sm:text-[11px]">
          #{index + 1}
        </span>
      </div>
    )
  }
  return (
    <div className="group relative aspect-[2/3] overflow-hidden rounded-lg border border-border sm:rounded-xl">
      <PersonajeImg
        slug={slug}
        src={personaje?.imagenUrl ?? personaje?.imagen}
        alt={personaje?.nombre ?? slug}
        className="h-full w-full object-cover object-top"
      />
      {/* Rank chip arriba — siempre visible para que la posición se lea
          de un vistazo aunque la card sea pequeña en mobile. */}
      <span className="absolute left-1 top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-accent px-1 text-[10px] font-extrabold text-bg sm:left-1.5 sm:top-1.5 sm:h-6 sm:min-w-[24px] sm:text-[11px]">
        #{index + 1}
      </span>
      {/* Nombre + anime: solo en sm+ (en mobile la card es demasiado
          estrecha para texto legible — la prioridad es ver el rostro). */}
      <div className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 sm:block">
        <p className="line-clamp-1 text-[12px] font-bold text-fg-strong">
          {personaje?.nombre ?? slug}
        </p>
        <p className="line-clamp-1 text-[10px] text-fg-muted">
          {personaje?.anime}
        </p>
      </div>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${personaje?.nombre ?? 'personaje'} del top`}
        className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-bg/80 text-fg-muted backdrop-blur-md transition-opacity hover:text-rose-300 sm:right-1 sm:top-1 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function CanvasPreview({ slots, completo, personajesBySlug }) {
  const canvasRef = useRef(null)
  const slotsSignature = slots.join('|')
  const [generando, setGenerando] = useState(false)
  const [preview, setPreview] = useState(null)
  const [compartiendo, setCompartiendo] = useState(false)
  const [fallbackText, setFallbackText] = useState('')
  const previewActual = preview?.signature === slotsSignature ? preview : null
  const fallbackTextActual = previewActual ? fallbackText : ''

  const generar = async () => {
    if (!completo || !canvasRef.current) return
    setGenerando(true)
    setFallbackText('')
    try {
      const canvas = canvasRef.current
      canvas.width = 1200
      canvas.height = 630
      const ctx = canvas.getContext('2d')

      // Fondo dark + aurora magenta blur fake
      ctx.fillStyle = '#0d0d12'
      ctx.fillRect(0, 0, 1200, 630)
      const grad = ctx.createRadialGradient(900, 100, 0, 900, 100, 600)
      grad.addColorStop(0, 'rgba(255, 46, 99, 0.4)')
      grad.addColorStop(1, 'rgba(255, 46, 99, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1200, 630)

      // Título
      ctx.fillStyle = '#f4f4f5'
      ctx.font = 'bold 60px Geist, system-ui, sans-serif'
      ctx.fillText('Mi Top 5 anime', 60, 90)
      ctx.fillStyle = '#a1a1aa'
      ctx.font = '24px Geist, system-ui, sans-serif'
      ctx.fillText('AnimeShowdown · animeshowdown.dev', 60, 130)

      // 5 cards: pos x=60, ancho 216, gap 12 → total 60 + 5*216 + 4*12 = 60+1080+48 = 1188 (ok hasta 1200)
      const cardW = 200
      const cardH = 360
      const startX = 80
      const startY = 200
      const gap = 14

      for (let i = 0; i < slots.length; i++) {
        const slug = slots[i]
        if (!slug) continue
        const personaje = personajesBySlug.get(slug)
        const x = startX + i * (cardW + gap)

        // Marco de card
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fillRect(x, startY, cardW, cardH)
        ctx.strokeStyle = 'rgba(255,46,99,0.4)'
        ctx.lineWidth = 2
        ctx.strokeRect(x, startY, cardW, cardH)

        // Avatar
        const img = await cargarImg(
          personaje?.imagenUrl ?? personaje?.imagen ?? imagenPersonaje(slug),
        )
        if (img) {
          ctx.drawImage(img, x + 12, startY + 12, cardW - 24, 240)
        }

        // Rank
        ctx.fillStyle = '#9f1d2c'
        ctx.font = 'bold 24px Geist, system-ui, sans-serif'
        ctx.fillText(`#${i + 1}`, x + 12, startY + 290)

        // Nombre
        ctx.fillStyle = '#f4f4f5'
        ctx.font = 'bold 20px Geist, system-ui, sans-serif'
        ctx.fillText(truncate(ctx, personaje?.nombre ?? slug, cardW - 24), x + 12, startY + 320)

        // Anime
        ctx.fillStyle = '#a1a1aa'
        ctx.font = '14px Geist, system-ui, sans-serif'
        ctx.fillText(truncate(ctx, personaje?.anime ?? '', cardW - 24), x + 12, startY + 345)
      }

      // Watermark abajo
      ctx.fillStyle = '#71717a'
      ctx.font = '18px Geist, system-ui, sans-serif'
      ctx.fillText('🔥 animeshowdown.dev', 60, 600)

      const blob = await canvasToPngBlob(canvas)
      const url = canvas.toDataURL('image/png')
      setPreview({ url, blob, signature: slotsSignature })
      toast.success('Imagen generada')
    } catch (err) {
      toast.error(`No se pudo generar: ${err.message}`)
    } finally {
      setGenerando(false)
    }
  }

  const descargar = () => {
    if (!previewActual) return
    const a = document.createElement('a')
    a.href = previewActual.url
    a.download = 'animeshowdown-mi-top5.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const compartir = async () => {
    if (!previewActual) return
    setCompartiendo(true)
    setFallbackText('')

    const text = buildTop5ShareText(slots, personajesBySlug)
    try {
      const file =
        previewActual.blob && typeof File !== 'undefined'
          ? new File([previewActual.blob], 'animeshowdown-mi-top5.png', {
              type: 'image/png',
            })
          : null
      const filePayload = file
        ? {
            title: 'Mi Top 5 anime',
            text,
            url: `${window.location.origin}/mi-top5`,
            files: [file],
          }
        : null

      if (
        filePayload &&
        typeof navigator !== 'undefined' &&
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        try {
          await navigator.share(filePayload)
          recordDailyShare()
          toast.success('Top 5 compartido')
          return
        } catch (error) {
          if (error?.name === 'AbortError') return
        }
      }

      const result = await shareOrCopy({
        title: 'Mi Top 5 anime',
        text,
        url: '/mi-top5',
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(
        result === 'native'
          ? 'Top 5 compartido'
          : 'Texto copiado. Adjunta la imagen descargada si quieres.',
      )
    } catch (error) {
      setFallbackText(error?.message || text)
      toast.error('No se pudo compartir', {
        description: 'Te dejo el texto visible para copiarlo a mano.',
      })
    } finally {
      setCompartiendo(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">
        Generar imagen
      </h2>
      <p className="mb-4 text-[12px] text-fg-muted">
        {completo
          ? 'Pulsa generar para crear la imagen 1200×630. Luego puedes descargarla y compartirla en cualquier red.'
          : `Faltan ${slots.filter((s) => !s).length} personajes para completar tu top 5.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generar}
          disabled={!completo || generando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          {generando ? 'Generando…' : 'Generar imagen'}
        </button>
        {previewActual && (
          <button
            type="button"
            onClick={descargar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-semibold text-fg-strong transition-colors hover:border-accent/40"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar PNG
          </button>
        )}
        {previewActual && (
          <button
            type="button"
            onClick={compartir}
            disabled={compartiendo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Share2 className="h-3.5 w-3.5" />
            {compartiendo ? 'Compartiendo…' : 'Compartir mi Top 5'}
          </button>
        )}
      </div>
      {previewActual && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            Vista previa
          </p>
          <img
            src={previewActual.url}
            alt="Vista previa de tu top 5"
            className="w-full rounded-lg border border-border"
          />
        </div>
      )}
      {fallbackTextActual && (
        <textarea
          readOnly
          value={fallbackTextActual}
          className="mt-4 min-h-28 w-full rounded-lg border border-border bg-bg/70 p-3 text-[12px] leading-5 text-fg-muted outline-none"
          aria-label="Texto de tu Top 5 para copiar manualmente"
        />
      )}
      <canvas
        ref={canvasRef}
        width={1200}
        height={630}
        className="hidden"
      />
    </div>
  )
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('El navegador no pudo exportar la imagen.'))
    }, 'image/png')
  })
}

function buildTop5ShareText(slots, personajesBySlug) {
  const ranking = slots
    .map((slug, index) => {
      const personaje = personajesBySlug.get(slug)
      return `${index + 1}. ${personaje?.nombre ?? slug}`
    })
    .join('\n')
  return `Mi Top 5 anime en AnimeShowdown:\n${ranking}\n\nHaz el tuyo y dime a quién quitarías.`
}

function cargarImg(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function truncate(ctx, texto, maxWidth) {
  if (ctx.measureText(texto).width <= maxWidth) return texto
  let truncado = texto
  while (truncado.length > 0 && ctx.measureText(truncado + '…').width > maxWidth) {
    truncado = truncado.slice(0, -1)
  }
  return truncado + '…'
}

export default MiTop5Page
