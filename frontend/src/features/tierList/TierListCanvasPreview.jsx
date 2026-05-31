import { useMemo, useRef, useState } from 'react'
import { Download, Image as ImageIcon, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { imagenPersonaje } from '../../lib/personajes-core'
import { recordDailyShare } from '../../lib/dailyProgress'
import { shareOrCopy } from '../../lib/share'
import { TOP5_CANVAS_THEME } from '../miTop5/top5-canvas-theme'

const TIERS = ['S', 'A', 'B', 'C', 'D', 'BANCA']
const TIER_LABEL = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  BANCA: 'Banca',
}

function TierListCanvasPreview({ titulo, rows, publicSlug }) {
  const canvasRef = useRef(null)
  const [generando, setGenerando] = useState(false)
  const [preview, setPreview] = useState(null)
  const [compartiendo, setCompartiendo] = useState(false)
  const signature = useMemo(
    () =>
      JSON.stringify({
        titulo,
        rows: TIERS.map((tier) => [tier, (rows[tier] ?? []).map((p) => p.slug)]),
      }),
    [rows, titulo],
  )
  const previewActual = preview?.signature === signature ? preview : null
  const total = TIERS.reduce((sum, tier) => sum + (rows[tier]?.length ?? 0), 0)
  const canGenerate = total > 0

  const generar = async () => {
    if (!canGenerate || !canvasRef.current) return
    setGenerando(true)
    try {
      const canvas = canvasRef.current
      canvas.width = 1200
      canvas.height = 630
      const ctx = canvas.getContext('2d')
      await renderTierListCanvas(ctx, { titulo, rows })
      const blob = await canvasToPngBlob(canvas)
      const url = canvas.toDataURL('image/png')
      setPreview({ url, blob, signature })
      toast.success('PNG generado')
    } catch (error) {
      toast.error(error?.message || 'No se pudo generar el PNG')
    } finally {
      setGenerando(false)
    }
  }

  const descargar = () => {
    if (!previewActual) return
    const a = document.createElement('a')
    a.href = previewActual.url
    a.download = 'animeshowdown-tier-list.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const compartir = async () => {
    if (!previewActual) return
    setCompartiendo(true)
    const shareUrl = publicSlug ? `/tier-lists/${publicSlug}` : '/tier-lists'
    const absoluteUrl =
      typeof window !== 'undefined'
        ? new URL(shareUrl, window.location.origin).toString()
        : shareUrl
    try {
      const file =
        previewActual.blob && typeof File !== 'undefined'
          ? new File([previewActual.blob], 'animeshowdown-tier-list.png', {
              type: 'image/png',
            })
          : null
      if (
        file &&
        typeof navigator !== 'undefined' &&
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        try {
          await navigator.share({
            title: titulo || 'Tier list anime',
            text: 'Mi tier list anime en AnimeShowdown',
            url: absoluteUrl,
            files: [file],
          })
          recordDailyShare()
          toast.success('Tier list compartida')
          return
        } catch (error) {
          if (error?.name === 'AbortError') return
        }
      }
      const result = await shareOrCopy({
        title: titulo || 'Tier list anime',
        text: 'Mi tier list anime en AnimeShowdown',
        url: shareUrl,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Tier list compartida' : 'Enlace copiado')
    } catch {
      toast.error('No se pudo compartir')
    } finally {
      setCompartiendo(false)
    }
  }

  return (
    <section className="border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.05em] text-fg-muted">
          Exportar PNG
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generar}
            disabled={!canGenerate || generando}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-black text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            {generando ? 'Generando' : 'Generar'}
          </button>
          {previewActual && (
            <button
              type="button"
              onClick={descargar}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-bg px-4 text-sm font-black text-fg-strong transition-colors hover:border-accent/45"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              PNG
            </button>
          )}
          {previewActual && (
            <button
              type="button"
              onClick={compartir}
              disabled={compartiendo}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gold/35 bg-gold-soft px-4 text-sm font-black text-gold transition-colors hover:border-gold/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Compartir
            </button>
          )}
        </div>
      </div>
      {previewActual && (
        <img
          src={previewActual.url}
          alt="Vista previa de la tier list"
          width={1200}
          height={630}
          className="mt-4 w-full rounded-lg border border-border"
        />
      )}
      <canvas ref={canvasRef} width={1200} height={630} className="hidden" />
    </section>
  )
}

async function renderTierListCanvas(ctx, { titulo, rows }) {
  ctx.fillStyle = TOP5_CANVAS_THEME.background
  ctx.fillRect(0, 0, 1200, 630)
  const grad = ctx.createRadialGradient(930, 90, 0, 930, 90, 620)
  grad.addColorStop(0, TOP5_CANVAS_THEME.auroraStart)
  grad.addColorStop(1, TOP5_CANVAS_THEME.auroraEnd)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1200, 630)

  ctx.fillStyle = TOP5_CANVAS_THEME.text
  ctx.font = 'bold 54px Geist, system-ui, sans-serif'
  ctx.fillText(truncate(ctx, titulo || 'Tier list anime', 820), 60, 78)
  ctx.fillStyle = TOP5_CANVAS_THEME.muted
  ctx.font = '22px Geist, system-ui, sans-serif'
  ctx.fillText('AnimeShowdown · animeshowdown.dev', 60, 116)

  const startY = 150
  const rowH = 72
  const gapY = 9
  const labelW = 100
  const cardW = 54
  const cardH = 62
  const cardGap = 8
  const maxCards = 16

  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i]
    const y = startY + i * (rowH + gapY)
    ctx.fillStyle = TOP5_CANVAS_THEME.cardFill
    ctx.fillRect(60, y, 1080, rowH)
    ctx.strokeStyle = TOP5_CANVAS_THEME.cardStroke
    ctx.lineWidth = 2
    ctx.strokeRect(60, y, 1080, rowH)

    ctx.fillStyle = tier === 'S' ? TOP5_CANVAS_THEME.accent : TOP5_CANVAS_THEME.watermark
    ctx.fillRect(60, y, labelW, rowH)
    ctx.fillStyle = TOP5_CANVAS_THEME.text
    ctx.font = tier === 'BANCA' ? 'bold 24px Geist, system-ui, sans-serif' : 'bold 34px Geist, system-ui, sans-serif'
    ctx.fillText(TIER_LABEL[tier], 82, y + 46)

    const personajes = rows[tier] ?? []
    const visibles = personajes.slice(0, maxCards)
    for (let j = 0; j < visibles.length; j++) {
      const personaje = visibles[j]
      const x = 176 + j * (cardW + cardGap)
      ctx.fillStyle = TOP5_CANVAS_THEME.background
      ctx.fillRect(x, y + 5, cardW, cardH)
      const img = await cargarImg(
        personaje?.imagenUrl ?? personaje?.imagen ?? imagenPersonaje(personaje?.slug),
      )
      if (img) {
        ctx.drawImage(img, x, y + 5, cardW, cardH)
      }
    }
    if (personajes.length > maxCards) {
      ctx.fillStyle = TOP5_CANVAS_THEME.text
      ctx.font = 'bold 24px Geist, system-ui, sans-serif'
      ctx.fillText(`+${personajes.length - maxCards}`, 176 + maxCards * (cardW + cardGap), y + 46)
    }
  }

  ctx.fillStyle = TOP5_CANVAS_THEME.watermark
  ctx.font = '18px Geist, system-ui, sans-serif'
  ctx.fillText('animeshowdown.dev', 60, 600)
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('El navegador no pudo exportar la imagen.'))
    }, 'image/png')
  })
}

function cargarImg(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function truncate(ctx, texto, maxWidth) {
  if (ctx.measureText(texto).width <= maxWidth) return texto
  let out = texto
  while (out.length > 0 && ctx.measureText(out + '...').width > maxWidth) {
    out = out.slice(0, -1)
  }
  return out + '...'
}

export default TierListCanvasPreview
