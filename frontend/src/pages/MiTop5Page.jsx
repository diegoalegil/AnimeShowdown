import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Download, Image as ImageIcon, Plus, X } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import AutocompletePersonaje from '../components/AutocompletePersonaje'
import { personajes, imagenPersonaje } from '../data/personajes'

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
 * Generador "Mi Top 5" (Plan v2 §11.10) — el usuario elige 5 personajes
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
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

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-5">
          {slots.map((slug, i) => (
            <Slot key={i} slug={slug} index={i} onQuitar={() => quitarSlot(i)} />
          ))}
        </div>

        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <p className="mb-3 text-sm font-semibold text-fg-strong">
            Añadir personaje al primer slot vacío
          </p>
          <AutocompletePersonaje
            onSelect={(slug) => {
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
            }}
            placeholder="Busca y selecciona…"
            filtroExtra={(p) => !slots.includes(p.slug)}
          />
        </div>

        <CanvasPreview slots={slots} completo={completo} />
      </div>
    </section>
  )
}

function Slot({ slug, index, onQuitar }) {
  if (!slug) {
    return (
      <div className="flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-bg/30 text-fg-muted">
        <Plus className="h-6 w-6" />
        <span className="text-[11px] font-semibold">#{index + 1}</span>
      </div>
    )
  }
  const p = personajes.find((x) => x.slug === slug)
  return (
    <div className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-border">
      <img
        src={imagenPersonaje(slug)}
        alt={p?.nombre ?? slug}
        className="h-full w-full object-cover object-top"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          #{index + 1}
        </p>
        <p className="line-clamp-1 text-[12px] font-bold text-fg-strong">
          {p?.nombre ?? slug}
        </p>
        <p className="line-clamp-1 text-[10px] text-fg-muted">{p?.anime}</p>
      </div>
      <button
        type="button"
        onClick={onQuitar}
        aria-label="Quitar"
        className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg/80 text-fg-muted opacity-0 backdrop-blur-md transition-opacity hover:text-rose-300 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function CanvasPreview({ slots, completo }) {
  const canvasRef = useRef(null)
  const [generando, setGenerando] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const generar = async () => {
    if (!completo || !canvasRef.current) return
    setGenerando(true)
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
        const personaje = personajes.find((p) => p.slug === slug)
        const x = startX + i * (cardW + gap)

        // Marco de card
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fillRect(x, startY, cardW, cardH)
        ctx.strokeStyle = 'rgba(255,46,99,0.4)'
        ctx.lineWidth = 2
        ctx.strokeRect(x, startY, cardW, cardH)

        // Avatar
        const img = await cargarImg(imagenPersonaje(slug))
        if (img) {
          ctx.drawImage(img, x + 12, startY + 12, cardW - 24, 240)
        }

        // Rank
        ctx.fillStyle = '#ff2e63'
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

      const url = canvas.toDataURL('image/png')
      setPreviewUrl(url)
      toast.success('Imagen generada')
    } catch (err) {
      toast.error(`No se pudo generar: ${err.message}`)
    } finally {
      setGenerando(false)
    }
  }

  const descargar = () => {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = 'animeshowdown-mi-top5.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
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
        {previewUrl && (
          <button
            type="button"
            onClick={descargar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-semibold text-fg-strong transition-colors hover:border-accent/40"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar PNG
          </button>
        )}
      </div>
      {previewUrl && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            Vista previa
          </p>
          <img
            src={previewUrl}
            alt="Vista previa de tu top 5"
            className="w-full rounded-lg border border-border"
          />
        </div>
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
