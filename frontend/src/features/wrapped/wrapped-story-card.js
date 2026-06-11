// wrapped-story-card.js — pintor canvas del capítulo final del Wrapped.
//
// Tarjeta vertical 9:16 (1080×1920) pintada DIRECTAMENTE en canvas — nada de
// rasterizar DOM (html-to-image & co. están prohibidos aquí: pesan, tienen
// bugs de fuentes en WebKit y rompen el presupuesto de bundle).
//
// ESM puro, cero dependencias. Lo importa WrappedCinematic.jsx con import()
// dinámico cuando el capítulo final entra en viewport — fuera del bundle
// inicial.
//
// Colores: se leen de los tokens CSS del proyecto en runtime
// (getComputedStyle sobre :root). Los literales de este archivo son SOLO
// fallbacks para entornos sin DOM tematizado (tests, SSR) — el guard de CI
// anti-hex aplica a JSX, no a este painter.
//
// CORS: la scene se carga con crossOrigin="anonymous" (el CDN R2 sirve
// Access-Control-Allow-Origin). Si la carga falla, se pinta un fondo de
// gradiente con los tokens y el canvas NUNCA queda tainted → toBlob siempre
// funciona.

export const STORY_CARD_W = 1080
export const STORY_CARD_H = 1920

const FALLBACKS = {
  '--color-bg': '#080b12',
  '--color-surface': '#101620',
  '--color-border': '#334155',
  '--color-fg': '#d7dce7',
  '--color-fg-strong': '#f7f3ea',
  '--color-fg-muted': '#a8b1c3',
  '--color-accent': '#9f1d2c',
  '--color-gold': '#c5a15a',
  '--color-gold-bright': '#e4c36f',
}

// El lienzo de la tarjeta es el negro más profundo de la marca (el fondo
// global degrada hacia él), no el bg de superficie.
const CANVAS_BLACK = '#04070c'

const FONT_MONO =
  'ui-monospace, "SFMono-Regular", "Cascadia Mono", "Segoe UI Mono", Consolas, Menlo, monospace'
const FONT_SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Hiragino Sans", Roboto, sans-serif'
const FONT_KANJI_SERIF =
  '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif'

const nf = new Intl.NumberFormat('es-ES')

function readTokens() {
  const out = {}
  let style = null
  if (typeof document !== 'undefined') {
    style = getComputedStyle(document.documentElement)
  }
  for (const [name, fallback] of Object.entries(FALLBACKS)) {
    const v = style ? style.getPropertyValue(name).trim() : ''
    out[name] = v || fallback
  }
  return out
}

function withAlpha(ctx, alpha, fn) {
  const prev = ctx.globalAlpha
  ctx.globalAlpha = alpha
  fn()
  ctx.globalAlpha = prev
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url || typeof Image === 'undefined') {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** drawImage con recorte tipo object-fit: cover. fx/fy = punto focal 0..1. */
function drawCover(ctx, img, dx, dy, dw, dh, fx = 0.5, fy = 0.38) {
  const scale = Math.max(dw / img.naturalWidth, dh / img.naturalHeight)
  const sw = dw / scale
  const sh = dh / scale
  const sx = Math.max(0, Math.min(img.naturalWidth - sw, img.naturalWidth * fx - sw / 2))
  const sy = Math.max(0, Math.min(img.naturalHeight - sh, img.naturalHeight * fy - sh / 2))
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

function fmt(n) {
  return nf.format(Number(n ?? 0))
}

/**
 * Pinta la tarjeta de temporada en `canvas` (lo redimensiona a 1080×1920).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} data
 * @param {string}  data.username
 * @param {string}  [data.temporada='2026']
 * @param {string}  [data.kanji='戦']           kanji de marca con significado
 * @param {string}  [data.fandomPrincipal]
 * @param {object}  [data.personajeTop]         { nombre, anime }
 * @param {string}  [data.sceneUrl]             scene del banco de marca (variante 1280)
 * @param {number}  data.votosTotales
 * @param {number}  data.duelosJugados
 * @param {number}  data.prediccionesAcertadas
 * @param {number}  data.badgesDesbloqueados
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function paintWrappedStoryCard(canvas, data = {}) {
  const t = readTokens()
  const W = STORY_CARD_W
  const H = STORY_CARD_H
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const {
    username = 'senpai',
    temporada = '2026',
    kanji = '戦',
    fandomPrincipal = null,
    personajeTop = null,
    sceneUrl = null,
  } = data

  // ── Fondo base ────────────────────────────────────────────────────────
  ctx.fillStyle = CANVAS_BLACK
  ctx.fillRect(0, 0, W, H)

  // ── Scene panorámica arriba (o gradiente de marca si no hay arte) ─────
  const SCENE_H = 980
  const scene = await loadImage(sceneUrl)
  if (scene) {
    drawCover(ctx, scene, 0, 0, W, SCENE_H, 0.5, 0.35)
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, SCENE_H)
    g.addColorStop(0, t['--color-surface'])
    g.addColorStop(1, CANVAS_BLACK)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, SCENE_H)
    const r = ctx.createRadialGradient(W * 0.82, 240, 60, W * 0.82, 240, 700)
    r.addColorStop(0, t['--color-accent'])
    r.addColorStop(1, 'rgba(0,0,0,0)')
    withAlpha(ctx, 0.16, () => {
      ctx.fillStyle = r
      ctx.fillRect(0, 0, W, SCENE_H)
    })
  }

  // Scrim de legibilidad: solo donde va a vivir texto (arriba para el
  // header, abajo fundiendo la scene con el cuerpo de la tarjeta).
  let g = ctx.createLinearGradient(0, 0, 0, 260)
  g.addColorStop(0, 'rgba(4,7,12,0.78)')
  g.addColorStop(1, 'rgba(4,7,12,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, 260)

  g = ctx.createLinearGradient(0, 380, 0, SCENE_H)
  g.addColorStop(0, 'rgba(4,7,12,0)')
  g.addColorStop(0.62, 'rgba(4,7,12,0.82)')
  g.addColorStop(1, CANVAS_BLACK)
  ctx.fillStyle = g
  ctx.fillRect(0, 380, W, SCENE_H - 380)

  // ── Kanji de marca como marca de agua (kanji REAL, no relleno) ────────
  ctx.save()
  ctx.font = `600 560px ${FONT_KANJI_SERIF}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  withAlpha(ctx, 0.09, () => {
    ctx.fillStyle = t['--color-gold']
    ctx.fillText(kanji, W + 40, 740)
  })
  ctx.restore()

  // ── Marco fino oro + esquinas (lenguaje de las cartas del proyecto) ───
  const M = 44
  withAlpha(ctx, 0.38, () => {
    ctx.strokeStyle = t['--color-gold']
    ctx.lineWidth = 2
    ctx.strokeRect(M, M, W - M * 2, H - M * 2)
  })
  ctx.strokeStyle = t['--color-gold']
  ctx.lineWidth = 4
  const C = 34
  for (const [cx, cy, dx, dy] of [
    [M, M, 1, 1],
    [W - M, M, -1, 1],
    [M, H - M, 1, -1],
    [W - M, H - M, -1, -1],
  ]) {
    ctx.beginPath()
    ctx.moveTo(cx, cy + C * dy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + C * dx, cy)
    ctx.stroke()
  }

  // ── Header ────────────────────────────────────────────────────────────
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = t['--color-accent']
  ctx.fillRect(96, 116, 14, 14)
  ctx.fillStyle = t['--color-gold-bright']
  ctx.font = `700 36px ${FONT_SANS}`
  ctx.fillText('AnimeShowdown Wrapped', 128, 132)
  ctx.textAlign = 'right'
  ctx.fillStyle = t['--color-fg-muted']
  ctx.font = `500 32px ${FONT_MONO}`
  ctx.fillText(`Temporada ${temporada}`, W - 96, 132)

  // ── Identidad ─────────────────────────────────────────────────────────
  ctx.textAlign = 'left'
  ctx.fillStyle = t['--color-accent']
  ctx.fillRect(96, 856, 56, 6)
  ctx.fillStyle = t['--color-fg-strong']
  ctx.font = `800 84px ${FONT_SANS}`
  ctx.fillText(`@${username}`, 96, 962)
  ctx.fillStyle = t['--color-fg-muted']
  ctx.font = `500 36px ${FONT_SANS}`
  ctx.fillText('Tu temporada en la arena', 96, 1018)

  // ── Stats 2×2, números en mono oro ────────────────────────────────────
  const stats = [
    { value: fmt(data.votosTotales), label: 'Votos emitidos' },
    { value: fmt(data.duelosJugados), label: 'Duelos jugados' },
    { value: fmt(data.prediccionesAcertadas), label: 'Predicciones acertadas' },
    { value: fmt(data.badgesDesbloqueados), label: 'Logros desbloqueados' },
  ]
  const GRID_TOP = 1106
  const ROW_H = 218
  const COL_X = [96, 568]

  withAlpha(ctx, 0.45, () => {
    ctx.strokeStyle = t['--color-border']
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(96, GRID_TOP + ROW_H)
    ctx.lineTo(W - 96, GRID_TOP + ROW_H)
    ctx.moveTo(W / 2 - 4, GRID_TOP + 28)
    ctx.lineTo(W / 2 - 4, GRID_TOP + ROW_H * 2 - 28)
    ctx.stroke()
  })

  stats.forEach((s, i) => {
    const x = COL_X[i % 2]
    const y = GRID_TOP + Math.floor(i / 2) * ROW_H
    ctx.fillStyle = t['--color-gold']
    ctx.font = `800 108px ${FONT_MONO}`
    ctx.fillText(s.value, x, y + 116)
    ctx.fillStyle = t['--color-fg-muted']
    ctx.font = `500 30px ${FONT_SANS}`
    ctx.fillText(s.label, x, y + 168)
  })

  // ── Fandom Nº1 + personaje top ───────────────────────────────────────
  const FAN_Y = 1610
  withAlpha(ctx, 0.45, () => {
    ctx.strokeStyle = t['--color-border']
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(96, FAN_Y - 58)
    ctx.lineTo(W - 96, FAN_Y - 58)
    ctx.stroke()
  })
  if (fandomPrincipal) {
    ctx.fillStyle = t['--color-gold']
    ctx.font = `700 30px ${FONT_SANS}`
    ctx.fillText('Fandom Nº1', 96, FAN_Y)
    ctx.fillStyle = t['--color-fg-strong']
    ctx.font = `800 58px ${FONT_SANS}`
    ctx.fillText(fandomPrincipal, 96, FAN_Y + 72)
  }
  if (personajeTop?.nombre) {
    ctx.fillStyle = t['--color-fg']
    ctx.font = `500 32px ${FONT_SANS}`
    ctx.fillText(`Personaje Nº1 · ${personajeTop.nombre}`, 96, FAN_Y + 132)
  }

  // ── Footer ────────────────────────────────────────────────────────────
  ctx.fillStyle = t['--color-fg-muted']
  ctx.font = `500 30px ${FONT_MONO}`
  ctx.fillText('animeshowdown.dev/wrapped', 96, H - 100)
  ctx.textAlign = 'right'
  ctx.fillStyle = t['--color-gold']
  ctx.font = `600 34px ${FONT_KANJI_SERIF}`
  withAlpha(ctx, 0.8, () => {
    ctx.fillText(kanji, W - 96, H - 100)
  })
  ctx.textAlign = 'left'

  return canvas
}

/** PNG de la tarjeta como Blob (null si el canvas quedó tainted — no debería). */
export function wrappedStoryCardBlob(canvas) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}

/** Descarga directa de la tarjeta como PNG. */
export async function downloadWrappedStoryCard(canvas, filename = 'animeshowdown-wrapped.png') {
  const blob = await wrappedStoryCardBlob(canvas)
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Revocar tras el tick: Safari cancela la descarga si se revoca síncrono.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return true
}

/**
 * Web Share API con la imagen adjunta; si el dispositivo no comparte
 * archivos, cae a descarga. Devuelve 'shared' | 'downloaded' | 'error'.
 */
export async function shareWrappedStoryCard(canvas, { title = 'Mi AnimeShowdown Wrapped', text = '' } = {}) {
  const blob = await wrappedStoryCardBlob(canvas)
  if (!blob) return 'error'
  const file = new File([blob], 'animeshowdown-wrapped.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text })
      return 'shared'
    } catch {
      // usuario canceló → no forzar descarga
      return 'error'
    }
  }
  const ok = await downloadWrappedStoryCard(canvas)
  return ok ? 'downloaded' : 'error'
}
