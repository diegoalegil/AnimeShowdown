/**
 * Tema del PNG exportado de Mi Top 5 (1200×630) — firma carmesí/oro.
 *
 * <p>Sustituye la "aurora magenta blur" por la composición «corte carmesí»:
 * fondo lienzo de marca + tajo diagonal carmesí + hairline de oro + kanji 戦
 * en marca de agua + numerales kanji 一二三四五 por rango. Cero blur, cero
 * magenta.
 *
 * <p>Los colores se leen de los tokens CSS (@theme en index.css) en runtime
 * vía getComputedStyle, con fallback hex SOLO aquí (archivo .js, fuera del
 * guard de hex en JSX). Getters perezosos: se evalúan al dibujar, cuando la
 * hoja de estilos ya está aplicada.
 *
 * <p><b>Integración en CanvasPreview.generar()</b> — diff mínimo:
 * <pre>
 *   - // Fondo dark + aurora magenta blur fake
 *   - ctx.fillStyle = TOP5_CANVAS_THEME.background
 *   - ctx.fillRect(0, 0, 1200, 630)
 *   - const grad = ctx.createRadialGradient(900, 100, 0, 900, 100, 600)
 *   - grad.addColorStop(0, TOP5_CANVAS_THEME.auroraStart)
 *   - grad.addColorStop(1, TOP5_CANVAS_THEME.auroraEnd)
 *   - ctx.fillStyle = grad
 *   - ctx.fillRect(0, 0, 1200, 630)
 *   + drawTop5Background(ctx, { width: 1200, height: 630 })
 * </pre>
 * Y para el rango de cada carta, en vez de `#${i + 1}` en accent:
 * <pre>
 *   + drawTop5Numeral(ctx, i, x + 26, startY + 28)
 * </pre>
 * Las claves antiguas (background/text/muted/accent/watermark/cardFill/
 * cardStroke/auroraStart/auroraEnd) se mantienen con valores on-brand, así
 * el resto del dibujo actual sigue funcionando sin tocarlo.
 */

const FALLBACKS = {
  '--color-bg': '#080b12',
  '--color-surface': '#101620',
  '--color-fg-strong': '#f7f3ea',
  '--color-fg-muted': '#a8b1c3',
  '--color-accent': '#9f1d2c',
  '--color-gold': '#c5a15a',
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

export const KANJI_RANGO = ['一', '二', '三', '四', '五']

export const KANJI_SERIF_STACK =
  '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif'

export const TOP5_CANVAS_THEME = {
  // ── Claves compatibles con el dibujo actual de CanvasPreview ──
  get background() { return cssToken('--color-bg') },
  get text() { return cssToken('--color-fg-strong') },
  get muted() { return cssToken('--color-fg-muted') },
  get accent() { return cssToken('--color-accent') },
  get watermark() { return conAlpha(cssToken('--color-gold'), 0.6) },
  get cardFill() { return cssToken('--color-surface') },
  get cardStroke() { return conAlpha(cssToken('--color-gold'), 0.35) },
  // Compat: si algún caller viejo sigue pintando la "aurora", que al menos
  // sea el vaho carmesí de marca y no magenta. Borrar cuando migre todo.
  get auroraStart() { return conAlpha(cssToken('--color-accent'), 0.2) },
  get auroraEnd() { return conAlpha(cssToken('--color-accent'), 0) },

  // ── Claves nuevas de la firma carmesí/oro ──
  get gold() { return cssToken('--color-gold') },
  get goldHairline() { return conAlpha(cssToken('--color-gold'), 0.5) },
  get goldRule() { return conAlpha(cssToken('--color-gold'), 0.32) },
  get bladeSoft() { return conAlpha(cssToken('--color-accent'), 0.13) },
  get bladeStrong() { return conAlpha(cssToken('--color-accent'), 0.3) },
  get kanjiWatermark() { return conAlpha(cssToken('--color-gold'), 0.05) },
  get numeralChip() { return conAlpha(cssToken('--color-bg'), 0.75) },
  get numeralStroke() { return conAlpha(cssToken('--color-gold'), 0.5) },
  get cardStrokeUno() { return conAlpha(cssToken('--color-gold'), 0.85) },
  get auraUno() { return conAlpha(cssToken('--color-gold'), 0.22) },
}

/**
 * Fondo «corte carmesí»: lienzo + tajo diagonal + hairline de oro + 戦.
 * Reemplaza al bloque de la aurora en CanvasPreview.generar().
 */
export function drawTop5Background(ctx, { width, height }) {
  const t = TOP5_CANVAS_THEME
  ctx.save()
  ctx.fillStyle = t.background
  ctx.fillRect(0, 0, width, height)

  // Tajo diagonal carmesí (dos bandas, la fina más intensa).
  ctx.fillStyle = t.bladeSoft
  ctx.beginPath()
  ctx.moveTo(width * 0.633, 0)
  ctx.lineTo(width * 0.792, 0)
  ctx.lineTo(width * 0.433, height)
  ctx.lineTo(width * 0.275, height)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = t.bladeStrong
  ctx.beginPath()
  ctx.moveTo(width * 0.821, 0)
  ctx.lineTo(width * 0.863, 0)
  ctx.lineTo(width * 0.504, height)
  ctx.lineTo(width * 0.463, height)
  ctx.closePath()
  ctx.fill()

  // Hairline de oro paralela al tajo.
  ctx.strokeStyle = t.goldHairline
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(width * 0.885, 0)
  ctx.lineTo(width * 0.527, height)
  ctx.stroke()

  // Kanji 戦 (batalla) en marca de agua — la marca usa kanji con significado.
  ctx.fillStyle = t.kanjiWatermark
  ctx.font = `900 ${Math.round(height * 0.524)}px ${KANJI_SERIF_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('戦', width * 0.733, height * 0.746)
  ctx.restore()
}

/**
 * Numeral kanji de rango (一..五) en chip oscuro con borde de oro.
 * index es 0-based; (cx, cy) es el centro del chip.
 */
export function drawTop5Numeral(ctx, index, cx, cy) {
  const t = TOP5_CANVAS_THEME
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, 17, 0, Math.PI * 2)
  ctx.fillStyle = t.numeralChip
  ctx.fill()
  ctx.strokeStyle = t.numeralStroke
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = t.gold
  ctx.font = `700 19px ${KANJI_SERIF_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(KANJI_RANGO[index] ?? String(index + 1), cx, cy + 1)
  ctx.restore()
}
