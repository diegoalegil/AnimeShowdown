import { useRef, useState } from 'react'
import { Download, Image as ImageIcon, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { imagenPersonaje } from '../../lib/personajes-core'
import { recordDailyShare } from '../../lib/dailyProgress'
import { shareOrCopy } from '../../lib/share'
import { TOP5_CANVAS_THEME } from './top5-canvas-theme'

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
      ctx.fillStyle = TOP5_CANVAS_THEME.background
      ctx.fillRect(0, 0, 1200, 630)
      const grad = ctx.createRadialGradient(900, 100, 0, 900, 100, 600)
      grad.addColorStop(0, TOP5_CANVAS_THEME.auroraStart)
      grad.addColorStop(1, TOP5_CANVAS_THEME.auroraEnd)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1200, 630)

      // Título
      ctx.fillStyle = TOP5_CANVAS_THEME.text
      ctx.font = 'bold 60px Geist, system-ui, sans-serif'
      ctx.fillText('Mi Top 5 anime', 60, 90)
      ctx.fillStyle = TOP5_CANVAS_THEME.muted
      ctx.font = '24px Geist, system-ui, sans-serif'
      ctx.fillText('AnimeShowdown · animeshowdown.dev', 60, 130)

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

        ctx.fillStyle = TOP5_CANVAS_THEME.cardFill
        ctx.fillRect(x, startY, cardW, cardH)
        ctx.strokeStyle = TOP5_CANVAS_THEME.cardStroke
        ctx.lineWidth = 2
        ctx.strokeRect(x, startY, cardW, cardH)

        const img = await cargarImg(
          personaje?.imagenUrl ?? personaje?.imagen ?? imagenPersonaje(slug),
        )
        if (img) {
          ctx.drawImage(img, x + 12, startY + 12, cardW - 24, 240)
        }

        ctx.fillStyle = TOP5_CANVAS_THEME.accent
        ctx.font = 'bold 24px Geist, system-ui, sans-serif'
        ctx.fillText(`#${i + 1}`, x + 12, startY + 290)

        ctx.fillStyle = TOP5_CANVAS_THEME.text
        ctx.font = 'bold 20px Geist, system-ui, sans-serif'
        ctx.fillText(truncate(ctx, personaje?.nombre ?? slug, cardW - 24), x + 12, startY + 320)

        ctx.fillStyle = TOP5_CANVAS_THEME.muted
        ctx.font = '14px Geist, system-ui, sans-serif'
        ctx.fillText(truncate(ctx, personaje?.anime ?? '', cardW - 24), x + 12, startY + 345)
      }

      ctx.fillStyle = TOP5_CANVAS_THEME.watermark
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
    const shareUrl = buildTop5ShareUrl(slots)
    const absoluteShareUrl =
      typeof window !== 'undefined'
        ? new URL(shareUrl, window.location.origin).toString()
        : shareUrl
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
            url: absoluteShareUrl,
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
        url: shareUrl,
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
    <div className="rounded-2xl border border-border bg-surface p-6">
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
            width={1200}
            height={630}
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

function buildTop5ShareUrl(slots) {
  const selected = slots.filter(Boolean)
  if (selected.length === 0) return '/mi-top5'
  return `/mi-top5?add=${encodeURIComponent(selected.join(','))}`
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

export default CanvasPreview
