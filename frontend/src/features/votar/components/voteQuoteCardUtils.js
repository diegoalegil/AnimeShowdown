import { imagenPersonaje } from '../../../lib/personajes-core'
import { TOP5_CANVAS_THEME } from '../../miTop5/top5-canvas-theme'

export const VOTE_QUOTE_CANVAS_WIDTH = 1200
export const VOTE_QUOTE_CANVAS_HEIGHT = 630

export function buildVoteQuoteShareText(personaje, intencion) {
  const nombre = personaje?.nombre ?? 'mi personaje'
  const motivo = intencion?.label ?? 'mi motivo'
  return `Voté a ${nombre} por: ${motivo}. ¿Tú a quién subirías?`
}

export function buildVoteQuoteShareUrl(personaje, rival) {
  if (!personaje?.slug) return '/votar'
  const params = new URLSearchParams({ personaje: personaje.slug })
  if (rival?.slug) params.set('rival', rival.slug)
  return `/votar?${params.toString()}`
}

export async function drawVoteQuoteCard(ctx, { personaje, intencion }) {
  if (!ctx) throw new Error('Canvas no disponible.')
  const nombre = personaje?.nombre ?? 'mi personaje'
  const motivo = intencion?.label ?? 'mi motivo'
  const slug = personaje?.slug
  const anime = personaje?.anime ?? 'Duelo anime'

  ctx.fillStyle = TOP5_CANVAS_THEME.background
  ctx.fillRect(0, 0, VOTE_QUOTE_CANVAS_WIDTH, VOTE_QUOTE_CANVAS_HEIGHT)

  const aurora = ctx.createRadialGradient(880, 70, 0, 880, 70, 700)
  aurora.addColorStop(0, TOP5_CANVAS_THEME.auroraStart)
  aurora.addColorStop(1, TOP5_CANVAS_THEME.auroraEnd)
  ctx.fillStyle = aurora
  ctx.fillRect(0, 0, VOTE_QUOTE_CANVAS_WIDTH, VOTE_QUOTE_CANVAS_HEIGHT)

  const image = await cargarImg(
    personaje?.imagenUrl ?? personaje?.imagen ?? (slug ? imagenPersonaje(slug) : null),
  )
  ctx.fillStyle = TOP5_CANVAS_THEME.cardFill
  ctx.fillRect(72, 72, 380, 486)
  ctx.strokeStyle = TOP5_CANVAS_THEME.cardStroke
  ctx.lineWidth = 4
  ctx.strokeRect(72, 72, 380, 486)
  if (image) {
    drawImageCover(ctx, image, 92, 92, 340, 446)
  }

  ctx.fillStyle = TOP5_CANVAS_THEME.muted
  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.fillText('AnimeShowdown', 520, 118)

  ctx.fillStyle = TOP5_CANVAS_THEME.text
  ctx.font = 'bold 62px system-ui, sans-serif'
  wrapText(ctx, `Voté a ${nombre}`, 520, 210, 590, 72)

  ctx.fillStyle = TOP5_CANVAS_THEME.accent
  ctx.font = 'bold 48px system-ui, sans-serif'
  wrapText(ctx, `por: ${motivo}`, 520, 384, 590, 58)

  ctx.fillStyle = TOP5_CANVAS_THEME.muted
  ctx.font = '24px system-ui, sans-serif'
  ctx.fillText(anime, 520, 520)

  ctx.fillStyle = TOP5_CANVAS_THEME.watermark
  ctx.font = '20px system-ui, sans-serif'
  ctx.fillText('animeshowdown.dev', 520, 558)
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('El navegador no pudo exportar la imagen.'))
    }, 'image/png')
  })
}

function drawImageCover(ctx, image, x, y, width, height) {
  const imageWidth = image.naturalWidth || image.width || width
  const imageHeight = image.naturalHeight || image.height || height
  const ratio = Math.max(width / imageWidth, height / imageHeight)
  const drawWidth = imageWidth * ratio
  const drawHeight = imageHeight * ratio
  const offsetX = x + (width - drawWidth) / 2
  const offsetY = y + (height - drawHeight) / 2
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/)
  let line = ''
  let currentY = y
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY)
      line = word
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  if (line) ctx.fillText(line, x, currentY)
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
