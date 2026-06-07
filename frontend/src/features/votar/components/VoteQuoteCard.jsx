import { useRef, useState } from 'react'
import { Download, Image as ImageIcon, Share2 } from 'lucide-react'
import { toast } from 'sonner'

import PersonajeImg from '../../../components/PersonajeImg'
import { recordDailyShare } from '../../../lib/dailyProgress'
import { shareOrCopy } from '../../../lib/share'
import {
  VOTE_QUOTE_CANVAS_HEIGHT,
  VOTE_QUOTE_CANVAS_WIDTH,
  buildVoteQuoteShareText,
  buildVoteQuoteShareUrl,
  canvasToPngBlob,
  drawVoteQuoteCard,
} from './voteQuoteCardUtils'

export default function VoteQuoteCard({ personaje, rival, intencion }) {
  const canvasRef = useRef(null)
  const [generando, setGenerando] = useState(false)
  const [preview, setPreview] = useState(null)
  const [compartiendo, setCompartiendo] = useState(false)
  const [fallbackText, setFallbackText] = useState('')

  const shareText = buildVoteQuoteShareText(personaje, intencion)
  const shareUrl = buildVoteQuoteShareUrl(personaje, rival)
  const motivo = intencion?.label ?? 'Motivo'

  async function generar() {
    if (!personaje || !canvasRef.current) return
    setGenerando(true)
    setFallbackText('')
    try {
      const canvas = canvasRef.current
      canvas.width = VOTE_QUOTE_CANVAS_WIDTH
      canvas.height = VOTE_QUOTE_CANVAS_HEIGHT
      const ctx = canvas.getContext('2d')
      await drawVoteQuoteCard(ctx, { personaje, intencion })
      const blob = await canvasToPngBlob(canvas)
      setPreview({
        blob,
        url: canvas.toDataURL('image/png'),
      })
      toast.success('Tarjeta generada')
    } catch (error) {
      toast.error('No se pudo generar la tarjeta', {
        description: error?.message || 'Inténtalo de nuevo.',
      })
    } finally {
      setGenerando(false)
    }
  }

  function descargar() {
    if (!preview?.url) return
    const a = document.createElement('a')
    a.href = preview.url
    a.download = `animeshowdown-voto-${personaje.slug}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function compartir() {
    setCompartiendo(true)
    setFallbackText('')
    try {
      const absoluteShareUrl =
        typeof window !== 'undefined'
          ? new URL(shareUrl, window.location.origin).toString()
          : shareUrl
      const file =
        preview?.blob && typeof File !== 'undefined'
          ? new File([preview.blob], `animeshowdown-voto-${personaje.slug}.png`, {
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
            title: `${personaje.nombre} ganó mi duelo`,
            text: shareText,
            url: absoluteShareUrl,
            files: [file],
          })
          recordDailyShare()
          toast.success('Tarjeta compartida')
          return
        } catch (error) {
          if (error?.name === 'AbortError') return
        }
      }

      const result = await shareOrCopy({
        title: `${personaje.nombre} ganó mi duelo`,
        text: shareText,
        url: shareUrl,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(
        result === 'native'
          ? 'Tarjeta compartida'
          : preview
            ? 'Texto copiado. Adjunta la tarjeta descargada si quieres.'
            : 'Texto copiado',
      )
    } catch (error) {
      setFallbackText(error?.message || shareText)
      toast.error('No se pudo compartir', {
        description: 'Te dejo el texto visible para copiarlo a mano.',
      })
    } finally {
      setCompartiendo(false)
    }
  }

  return (
    <section className="rounded-lg border border-gold/30 bg-surface px-4 py-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
        <div className="mx-auto aspect-[2/3] w-full max-w-44 overflow-hidden rounded-lg border border-border bg-bg">
          <PersonajeImg
            slug={personaje.slug}
            alt={personaje.nombre}
            nombre={personaje.nombre}
            colorDominante={personaje.imagenColorDominante}
            className="h-full w-full object-cover"
            sizes="176px"
          />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black text-gold">
            Quote del duelo
          </p>
          <h2 className="mt-1 text-lg font-black leading-tight text-fg-strong">
            Voté a {personaje.nombre} por: {motivo}
          </h2>
          <p className="mt-1 text-[12px] text-fg-muted">
            Tu motivo queda en una tarjeta lista para descargar o compartir.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generar}
              disabled={generando}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12px] font-black text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {generando ? 'Generando…' : preview ? 'Regenerar tarjeta' : 'Generar tarjeta'}
            </button>
            {preview && (
              <button
                type="button"
                onClick={descargar}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-bg px-3.5 py-2 text-[12px] font-black text-fg-strong transition-colors hover:border-gold/50 hover:text-gold"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar PNG
              </button>
            )}
            {preview && (
              <button
                type="button"
                onClick={compartir}
                disabled={compartiendo}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gold/40 bg-gold-soft px-3.5 py-2 text-[12px] font-black text-gold transition-colors hover:border-gold hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Share2 className="h-3.5 w-3.5" />
                {compartiendo ? 'Compartiendo…' : 'Compartir tarjeta'}
              </button>
            )}
          </div>
        </div>
      </div>
      {preview?.url && (
        <img
          src={preview.url}
          alt={`Tarjeta de voto por ${personaje.nombre}`}
          width={VOTE_QUOTE_CANVAS_WIDTH}
          height={VOTE_QUOTE_CANVAS_HEIGHT}
          className="mt-4 w-full rounded-lg border border-border"
        />
      )}
      {fallbackText && (
        <textarea
          readOnly
          value={fallbackText}
          className="mt-4 min-h-24 w-full rounded-lg border border-border bg-bg/70 p-3 text-[12px] leading-5 text-fg-muted outline-none"
          aria-label="Texto de tu voto para copiar manualmente"
        />
      )}
      <canvas
        ref={canvasRef}
        width={VOTE_QUOTE_CANVAS_WIDTH}
        height={VOTE_QUOTE_CANVAS_HEIGHT}
        className="hidden"
      />
    </section>
  )
}
