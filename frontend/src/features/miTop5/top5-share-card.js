// top5-share-card.js — pintor canvas + contexto de compartir de Mi Top 5.
//
// El DIBUJO es exactamente el de CanvasPreview.generar() (1200×630, firma
// carmesí/oro vía drawTop5Background/drawTop5Numeral): no se reescribe, solo
// se extrae a una función re-invocable que devuelve un Blob PNG, el contrato
// que pide PressSheet (painter: () => Promise<Blob>).

import { imagenPersonaje } from '../../lib/personajes-core'
import { TOP5_CANVAS_THEME, drawTop5Background, drawTop5Numeral } from './top5-canvas-theme'

export const TOP5_CARD_W = 1200
export const TOP5_CARD_H = 630

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

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('El navegador no pudo exportar la imagen.'))
    }, 'image/png')
  })
}

/**
 * Pinta la card 1200×630 de Mi Top 5 en un canvas offscreen y resuelve su PNG.
 * Dibujo idéntico al de CanvasPreview.generar() (no se toca el lienzo).
 * @returns {Promise<Blob>}
 */
export async function pintarTop5Blob(slots, personajesBySlug) {
  const canvas = document.createElement('canvas')
  canvas.width = TOP5_CARD_W
  canvas.height = TOP5_CARD_H
  const ctx = canvas.getContext('2d')

  // Fondo «corte carmesí»: lienzo + tajo diagonal + hairline de oro + 戦
  drawTop5Background(ctx, { width: TOP5_CARD_W, height: TOP5_CARD_H })

  // Título
  ctx.fillStyle = TOP5_CANVAS_THEME.text
  ctx.font = 'bold 60px system-ui, sans-serif'
  ctx.fillText('Mi Top 5 anime', 60, 90)
  ctx.fillStyle = TOP5_CANVAS_THEME.muted
  ctx.font = '24px system-ui, sans-serif'
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

    // Numeral kanji de rango (一..五) en chip con borde de oro
    drawTop5Numeral(ctx, i, x + 26, startY + 288)

    ctx.fillStyle = TOP5_CANVAS_THEME.text
    ctx.font = 'bold 20px system-ui, sans-serif'
    ctx.fillText(truncate(ctx, personaje?.nombre ?? slug, cardW - 24), x + 12, startY + 320)

    ctx.fillStyle = TOP5_CANVAS_THEME.muted
    ctx.font = '14px system-ui, sans-serif'
    ctx.fillText(truncate(ctx, personaje?.anime ?? '', cardW - 24), x + 12, startY + 345)
  }

  ctx.fillStyle = TOP5_CANVAS_THEME.watermark
  ctx.font = '18px system-ui, sans-serif'
  ctx.fillText('animeshowdown.dev · 戦', 60, 600)

  return canvasToPngBlob(canvas)
}

export function buildTop5ShareText(slots, personajesBySlug) {
  const ranking = slots
    .map((slug, index) => {
      const personaje = personajesBySlug.get(slug)
      return `${index + 1}. ${personaje?.nombre ?? slug}`
    })
    .join('\n')
  return `Mi Top 5 anime en AnimeShowdown:\n${ranking}\n\nHaz el tuyo y dime a quién quitarías.`
}

export function buildTop5ShareUrl(slots) {
  const selected = slots.filter(Boolean)
  if (selected.length === 0) return '/mi-top5'
  return `/mi-top5?add=${encodeURIComponent(selected.join(','))}`
}

export function buildTop5Alt(slots, personajesBySlug) {
  const ranking = slots
    .map((slug, index) => {
      const personaje = personajesBySlug.get(slug)
      return `${index + 1}. ${personaje?.nombre ?? slug}`
    })
    .join(', ')
  return `Tu top 5 de personajes anime: ${ranking}`
}
