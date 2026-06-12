/**
 * Tema del PNG exportado de tier lists (1200×630) — «marco de federación».
 *
 * <p>Destino sugerido: frontend/src/features/tierList/tierlist-export-theme.js
 *
 * <p>El share deja de ser una captura cruda: el PNG sale enmarcado con la
 * doble hairline dorada de la federación, el wordmark, y el sello hanko 戦
 * (batalla). Las bandas replican el lacado oscuro del editor con su kanji
 * de rango grabado a la izquierda: 神 強 良 可 微 控 — jerarquía por
 * caligrafía, no por arcoíris.
 *
 * <p>Mismo patrón que top5-canvas-theme.js: los colores se leen de los
 * tokens CSS (@theme en index.css) en runtime vía getComputedStyle, con
 * fallback hex SOLO aquí (archivo .js, fuera del guard de hex en JSX).
 * Getters perezosos: se evalúan al dibujar, con la hoja ya aplicada.
 *
 * <p><b>Carga</b>: este módulo es el "pintor pesado" — impórtalo con
 * import() dinámico desde el panel de export para no engordar el bundle
 * inicial (≤210KB gz):
 * <pre>
 *   const { renderTierListExport } = await import('./tierlist-export-theme')
 * </pre>
 */

const FALLBACKS = {
  '--color-canvas': '#04070c',
  '--color-bg': '#080b12',
  '--color-surface': '#101620',
  '--color-surface-alt': '#171f2c',
  '--color-fg-strong': '#f7f3ea',
  '--color-fg-muted': '#a8b1c3',
  '--color-hanko': '#d62b2b',
  '--color-gold': '#c5a15a',
  '--color-gold-bright': '#e4c36f',
  '--color-gold-pale': '#f7e6a2',
}

function cssToken(name) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return FALLBACKS[name]
  }
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return valor || FALLBACKS[name]
}

/** '#rrggbb' → 'rgb(r g b / alpha)'. Si el token no es hex, lo devuelve tal cual. */
function conAlpha(color, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(color)
  if (!m) return color
  const n = parseInt(m[1], 16)
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`
}

export const KANJI_SERIF_STACK =
  '"AS Display", "AS Display Fallback", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif'
const SANS_STACK = 'system-ui, sans-serif'
const MONO_STACK = 'ui-monospace, "SFMono-Regular", Menlo, monospace'

/**
 * Kanji de rango — caligrafía con significado:
 * 神 dios (S) · 強 fuerte (A) · 良 bueno (B) · 可 aceptable (C) ·
 * 微 ínfimo (D) · 控 reserva (banca).
 */
export const TIER_KANJI = { S: '神', A: '強', B: '良', C: '可', D: '微', BANCA: '控' }
export const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'BANCA']

/** Jerarquía por caligrafía: tamaño y tinta descienden con el rango. */
export const TIER_CALIGRAFIA = {
  S: { size: 44, ink: 0.95, bright: true },
  A: { size: 38, ink: 0.72 },
  B: { size: 34, ink: 0.55 },
  C: { size: 31, ink: 0.42 },
  D: { size: 29, ink: 0.33 },
  BANCA: { size: 24, ink: 0.28 },
}

export const TIERLIST_EXPORT_THEME = {
  get canvas() { return cssToken('--color-canvas') },
  get bg() { return cssToken('--color-bg') },
  get surface() { return cssToken('--color-surface') },
  get surfaceAlt() { return cssToken('--color-surface-alt') },
  get text() { return cssToken('--color-fg-strong') },
  get muted() { return cssToken('--color-fg-muted') },
  get gold() { return cssToken('--color-gold') },
  get goldBright() { return cssToken('--color-gold-bright') },
  get goldPale() { return cssToken('--color-gold-pale') },
  get hanko() { return cssToken('--color-hanko') },
  get frameOuter() { return conAlpha(cssToken('--color-gold'), 0.55) },
  get frameInner() { return conAlpha(cssToken('--color-gold'), 0.2) },
  get bandStroke() { return conAlpha(cssToken('--color-gold'), 0.16) },
  get bandHairline() { return 'rgb(255 255 255 / 0.05)' },
  get footerRule() { return conAlpha(cssToken('--color-gold'), 0.28) },
  get metaGold() { return conAlpha(cssToken('--color-gold'), 0.75) },
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Marco de federación: doble hairline dorada + ticks de esquina. */
export function drawFederationFrame(ctx, w, h) {
  const t = TIERLIST_EXPORT_THEME
  ctx.save()
  ctx.strokeStyle = t.frameOuter
  ctx.lineWidth = 1.5
  ctx.strokeRect(14.5, 14.5, w - 29, h - 29)
  ctx.strokeStyle = t.frameInner
  ctx.lineWidth = 1
  ctx.strokeRect(20.5, 20.5, w - 41, h - 41)

  ctx.strokeStyle = t.goldBright
  ctx.lineWidth = 2
  const tick = 13
  for (const [cx, cy, sx, sy] of [
    [14.5, 14.5, 1, 1],
    [w - 14.5, 14.5, -1, 1],
    [14.5, h - 14.5, 1, -1],
    [w - 14.5, h - 14.5, -1, -1],
  ]) {
    ctx.beginPath()
    ctx.moveTo(cx + sx * tick, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + sy * tick)
    ctx.stroke()
  }
  ctx.restore()
}

/** Sello hanko con 戦 (batalla). */
export function drawHanko(ctx, x, y, size) {
  const t = TIERLIST_EXPORT_THEME
  ctx.save()
  rr(ctx, x, y, size, size, 5)
  ctx.fillStyle = t.hanko
  ctx.fill()
  ctx.strokeStyle = conAlpha(t.gold, 0.5)
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = t.goldPale
  ctx.font = `700 ${Math.round(size * 0.62)}px ${KANJI_SERIF_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('戦', x + size / 2, y + size / 2 + 1)
  ctx.restore()
}

/** Kanji grabado: sombra oscura arriba + filo de luz abajo + tinta dorada. */
export function drawEngravedKanji(ctx, kanji, cx, cy, cal) {
  const t = TIERLIST_EXPORT_THEME
  ctx.save()
  ctx.font = `900 ${cal.size}px ${KANJI_SERIF_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgb(0 0 0 / 0.85)'
  ctx.fillText(kanji, cx, cy - 1)
  ctx.fillStyle = 'rgb(255 255 255 / 0.07)'
  ctx.fillText(kanji, cx, cy + 1)
  ctx.fillStyle = conAlpha(cal.bright ? t.goldBright : t.gold, cal.ink)
  ctx.fillText(kanji, cx, cy)
  ctx.restore()
}

/** Carta 2:3 — imagen real (cover crop) o placeholder de color dominante. */
function drawCardTile(ctx, personaje, img, x, y, w, h) {
  const t = TIERLIST_EXPORT_THEME
  ctx.save()
  rr(ctx, x, y, w, h, 4)
  ctx.clip()
  if (img) {
    const ratio = Math.max(w / img.width, h / img.height)
    ctx.drawImage(img, x + (w - img.width * ratio) / 2, y, img.width * ratio, img.height * ratio)
  } else {
    ctx.fillStyle = personaje.imagenColorDominante || t.surfaceAlt
    ctx.fillRect(x, y, w, h)
    const g = ctx.createLinearGradient(0, y, 0, y + h)
    g.addColorStop(0, 'rgb(255 255 255 / 0.1)')
    g.addColorStop(0.4, 'rgb(0 0 0 / 0)')
    g.addColorStop(1, 'rgb(0 0 0 / 0.45)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = conAlpha(t.text, 0.88)
    ctx.font = `700 13px ${KANJI_SERIF_STACK}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(iniciales(personaje.nombre), x + w / 2, y + h / 2)
  }
  ctx.restore()
  ctx.save()
  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 4)
  ctx.strokeStyle = 'rgb(255 255 255 / 0.12)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function iniciales(nombre) {
  return (nombre || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
}

function truncate(ctx, texto, maxWidth) {
  if (ctx.measureText(texto).width <= maxWidth) return texto
  let out = texto
  while (out.length > 0 && ctx.measureText(out + '…').width > maxWidth) {
    out = out.slice(0, -1)
  }
  return out + '…'
}

/**
 * Pinta el PNG completo de la tier list.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {string} opts.titulo
 * @param {string} [opts.usuario]  p.ej. '@miyamoto'
 * @param {Record<string, Array>} opts.rows  { S: [personaje], ... }
 * @param {(p: object) => Promise<HTMLImageElement|null>} [opts.loadImage]
 *   Cargador de imagen de carta (imagenPersonaje + crossOrigin). Si falla o
 *   no se pasa, la carta cae al placeholder de color dominante + iniciales.
 */
export async function renderTierListExport(ctx, opts) {
  const t = TIERLIST_EXPORT_THEME
  const W = opts.width || 1200
  const H = opts.height || 630
  const { titulo, usuario, rows } = opts
  const loadImage = opts.loadImage || (async () => null)

  /* Asegura la caligrafía de marca antes de pintar. */
  if (typeof document !== 'undefined' && document.fonts?.load) {
    try {
      await Promise.all([
        document.fonts.load('900 44px "AS Display"'),
        document.fonts.load('700 18px "AS Display"'),
      ])
    } catch {
      /* el stack serif del sistema cubre el fallback */
    }
  }

  ctx.fillStyle = t.canvas
  ctx.fillRect(0, 0, W, H)
  drawFederationFrame(ctx, W, H)

  /* Cabecera */
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = t.text
  ctx.font = `900 36px ${SANS_STACK}`
  ctx.fillText(truncate(ctx, titulo || 'Tier list anime', 860), 52, 74)
  ctx.fillStyle = t.metaGold
  ctx.font = `500 15px ${MONO_STACK}`
  const fecha = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  ctx.fillText((usuario ? `${usuario} · ` : '') + fecha, 52, 100)

  /* Bandas lacadas */
  const x0 = 52
  const bw = W - 104
  const labelW = 84
  const rowH = 66
  const gap = 7
  let y = 122

  for (const tier of TIER_ORDER) {
    const cal = TIER_CALIGRAFIA[tier]

    const g = ctx.createLinearGradient(0, y, 0, y + rowH)
    g.addColorStop(0, t.surface)
    g.addColorStop(1, t.bg)
    rr(ctx, x0, y, bw, rowH, 9)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = t.bandStroke
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = t.bandHairline
    ctx.fillRect(x0 + 9, y + 1, bw - 18, 1)

    /* celda del rango: lacado profundo + canto dorado */
    ctx.save()
    rr(ctx, x0, y, bw, rowH, 9)
    ctx.clip()
    const gl = ctx.createLinearGradient(0, y, 0, y + rowH)
    gl.addColorStop(0, t.surfaceAlt)
    gl.addColorStop(1, t.canvas)
    ctx.fillStyle = gl
    ctx.fillRect(x0, y, labelW, rowH)
    ctx.fillStyle = t.bandStroke
    ctx.fillRect(x0 + labelW, y, 1, rowH)
    const ge = ctx.createLinearGradient(0, y, 0, y + rowH)
    ge.addColorStop(0, conAlpha(t.gold, 0.85))
    ge.addColorStop(1, conAlpha(t.gold, 0.25))
    ctx.fillStyle = ge
    ctx.fillRect(x0, y, 3, rowH)
    ctx.restore()

    drawEngravedKanji(ctx, TIER_KANJI[tier], x0 + labelW / 2 + 1, y + rowH / 2 + 1, cal)
    ctx.fillStyle = conAlpha(t.gold, 0.5)
    ctx.font = `700 10px ${MONO_STACK}`
    ctx.textAlign = 'right'
    ctx.fillText(tier === 'BANCA' ? 'BANCA' : tier, x0 + labelW - 7, y + 14)
    ctx.textAlign = 'left'

    /* cartas 2:3 */
    const personajes = rows[tier] ?? []
    const tileW = 36
    const tileH = 54
    const tileGap = 6
    const maxTiles = Math.floor((bw - labelW - 64) / (tileW + tileGap))
    const visibles = personajes.slice(0, maxTiles)
    for (let j = 0; j < visibles.length; j++) {
      let img = null
      try {
        img = await loadImage(visibles[j])
      } catch {
        /* sin arte: el tile pinta su placeholder de color dominante */
      }
      drawCardTile(
        ctx,
        visibles[j],
        img,
        x0 + labelW + 12 + j * (tileW + tileGap),
        y + (rowH - tileH) / 2,
        tileW,
        tileH,
      )
    }
    if (personajes.length > maxTiles) {
      ctx.fillStyle = t.muted
      ctx.font = `700 15px ${MONO_STACK}`
      ctx.textBaseline = 'middle'
      ctx.fillText(
        `+${personajes.length - maxTiles}`,
        x0 + labelW + 16 + maxTiles * (tileW + tileGap),
        y + rowH / 2,
      )
      ctx.textBaseline = 'alphabetic'
    }

    y += rowH + gap
  }

  /* Pie de federación: regla, wordmark y sello 戦 */
  ctx.strokeStyle = t.footerRule
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0, 570.5)
  ctx.lineTo(W - 52, 570.5)
  ctx.stroke()

  ctx.fillStyle = t.text
  ctx.font = `700 19px ${KANJI_SERIF_STACK}`
  ctx.fillText('AnimeShowdown', x0, 600)
  ctx.fillStyle = t.metaGold
  ctx.font = `500 13px ${MONO_STACK}`
  ctx.fillText('animeshowdown.dev/tier-lists', x0 + 168, 600)

  drawHanko(ctx, W - 52 - 38, 577, 38)
}
