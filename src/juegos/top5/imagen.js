// La imagen compartible de Mi Top 5: un lienzo de 1200×630 dibujado en el
// navegador con los colores de la web (leídos de los tokens CSS, no hay un
// hex aquí), el corte carmesí en diagonal, el filete dorado, las cinco cartas
// con nombre y serie, el título y la marca «AnimeShowdown». Lo que no toca el
// canvas (medidas, truncado, paleta) es puro y se prueba aparte.
import { imagenCarta } from '../../lib/images.js'
import { NUMERALES } from './reglas.js'

export const ANCHO = 1200
export const ALTO = 630
export const NOMBRE_ARCHIVO = 'animeshowdown-mi-top5.png'

/** Tokens de index.css que usa el dibujo y su respaldo si no se pueden leer. */
export const TOKENS = {
  lienzo: ['--color-canvas', 'rgb(4 7 12)'],
  fondo: ['--color-bg', 'rgb(8 11 18)'],
  superficie: ['--color-surface', 'rgb(16 22 32)'],
  carmesi: ['--color-accent', 'rgb(159 29 44)'],
  carmesiVivo: ['--color-accent-hover', 'rgb(190 43 56)'],
  oro: ['--color-gold', 'rgb(197 161 90)'],
  oroVivo: ['--color-gold-bright', 'rgb(228 195 111)'],
  oroPalido: ['--color-gold-pale', 'rgb(247 230 162)'],
  texto: ['--color-fg-strong', 'rgb(247 243 234)'],
  textoSuave: ['--color-fg-muted', 'rgb(168 177 195)'],
  display: ['--font-display', 'Georgia, serif'],
  sans: ['--font-sans', 'system-ui, sans-serif'],
}

/** La paleta del dibujo leída de los tokens en cascada sobre `elemento`. */
export function paletaDesde(elemento = globalThis.document?.documentElement) {
  const estilos = elemento && globalThis.getComputedStyle ? getComputedStyle(elemento) : null
  const paleta = {}
  for (const [clave, [token, respaldo]] of Object.entries(TOKENS)) {
    const valor = estilos?.getPropertyValue(token).trim()
    paleta[clave] = valor || respaldo
  }
  return paleta
}

/**
 * Dónde va cada una de las cinco cartas: una fila centrada bajo el título,
 * con la nº 1 un poco más alta y grande que el resto.
 */
export function disposicion(ancho = ANCHO, alto = ALTO) {
  const hueco = 22
  const anchoCarta = 184
  const altoCarta = Math.round(anchoCarta * 1.5)
  const total = anchoCarta * 5 + hueco * 4
  const x0 = Math.round((ancho - total) / 2)
  const base = alto - 64 // la línea del pie de las peanas
  return NUMERALES.map((numeral, i) => {
    const primera = i === 0
    const escala = primera ? 1.08 : 1
    const w = Math.round(anchoCarta * escala)
    const h = Math.round(altoCarta * escala)
    const x = Math.round(x0 + i * (anchoCarta + hueco) - (w - anchoCarta) / 2)
    return { numeral, puesto: i + 1, x, y: base - h - 56, w, h }
  })
}

/** Acorta `texto` con «…» hasta que `medir(texto)` quepa en `maximo`. */
export function truncar(medir, texto, maximo) {
  if (medir(texto) <= maximo) return texto
  let corto = texto
  while (corto.length > 1 && medir(`${corto}…`) > maximo) corto = corto.slice(0, -1)
  return `${corto.trimEnd()}…`
}

/** Carga una imagen del mismo origen; si falla, null (se pinta un marco de color). */
export function cargarImagen(src) {
  return new Promise((resolver) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolver(img)
    img.onerror = () => resolver(null)
    img.src = src
  })
}

/** Dibuja `img` recortada (cover) dentro del rectángulo, como object-fit: cover. */
function pintarCubriendo(ctx, img, x, y, w, h) {
  const proporcion = img.naturalWidth / img.naturalHeight
  const objetivo = w / h
  let sx = 0
  let sy = 0
  let sw = img.naturalWidth
  let sh = img.naturalHeight
  if (proporcion > objetivo) {
    sw = Math.round(sh * objetivo)
    sx = Math.round((img.naturalWidth - sw) / 2)
  } else {
    sh = Math.round(sw / objetivo)
    sy = Math.round((img.naturalHeight - sh) * 0.2) // las caras suelen estar arriba
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function rectanguloRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/**
 * Pinta la imagen completa en `ctx` (un canvas de ANCHO×ALTO). `cartas` son
 * las cinco cartas del catálogo en orden; `imagenes`, sus <img> cargadas (o
 * null). Es síncrono: la carga de imágenes y fuentes va antes (ver crearPng).
 */
export function pintar(ctx, cartas, imagenes, paleta) {
  const W = ANCHO
  const H = ALTO

  // Lienzo oscuro con una ligera luz arriba a la izquierda.
  ctx.fillStyle = paleta.lienzo
  ctx.fillRect(0, 0, W, H)
  const luz = ctx.createRadialGradient(240, 80, 40, 240, 80, 900)
  luz.addColorStop(0, paleta.superficie)
  luz.addColorStop(1, paleta.lienzo)
  ctx.fillStyle = luz
  ctx.fillRect(0, 0, W, H)

  // El corte carmesí: un tajo diagonal por la derecha, con su filete de oro.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(W * 0.62, 0)
  ctx.lineTo(W, 0)
  ctx.lineTo(W, H)
  ctx.lineTo(W * 0.5, H)
  ctx.closePath()
  const tajo = ctx.createLinearGradient(W * 0.5, H, W, 0)
  tajo.addColorStop(0, paleta.carmesi)
  tajo.addColorStop(1, paleta.carmesiVivo)
  ctx.fillStyle = tajo
  ctx.globalAlpha = 0.92
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = paleta.oro
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W * 0.62 - 10, 0)
  ctx.lineTo(W * 0.5 - 10, H)
  ctx.stroke()

  // Un 五 enorme y tenue, como la marca de agua del altar.
  ctx.save()
  ctx.globalAlpha = 0.1
  ctx.fillStyle = paleta.oroPalido
  ctx.font = `700 420px ${paleta.display}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('五', W - 400, H - 40)
  ctx.restore()

  // Filete dorado alrededor, doble, como el marco de las cartas.
  ctx.strokeStyle = paleta.oro
  ctx.lineWidth = 2
  ctx.strokeRect(18, 18, W - 36, H - 36)
  ctx.globalAlpha = 0.45
  ctx.lineWidth = 1
  ctx.strokeRect(26, 26, W - 52, H - 52)
  ctx.globalAlpha = 1

  // Título y rótulo.
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = paleta.oroVivo
  ctx.font = `500 15px ${paleta.sans}`
  ctx.letterSpacing = '4px'
  ctx.fillText('MI ALTAR · CINCO CARTAS', 60, 72)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = paleta.texto
  ctx.font = `700 64px ${paleta.display}`
  ctx.fillText('Mi Top 5', 58, 136)

  // Las cinco cartas, cada una sobre su peana con su numeral.
  const medir = (t) => ctx.measureText(t).width
  disposicion().forEach((p, i) => {
    const carta = cartas[i]
    const img = imagenes[i]
    const primera = i === 0

    // Sombra y marco.
    ctx.save()
    ctx.shadowColor = 'rgb(0 0 0 / 0.7)'
    ctx.shadowBlur = 28
    ctx.shadowOffsetY = 14
    rectanguloRedondo(ctx, p.x, p.y, p.w, p.h, 10)
    ctx.fillStyle = paleta.superficie
    ctx.fill()
    ctx.restore()

    // Ilustración recortada al marco (o el color del personaje si no cargó).
    ctx.save()
    rectanguloRedondo(ctx, p.x, p.y, p.w, p.h, 10)
    ctx.clip()
    if (img) pintarCubriendo(ctx, img, p.x, p.y, p.w, p.h)
    else {
      ctx.fillStyle = carta?.color ?? paleta.superficie
      ctx.fillRect(p.x, p.y, p.w, p.h)
    }
    // Un velo oscuro abajo para que se lea el nombre.
    const velo = ctx.createLinearGradient(0, p.y + p.h * 0.5, 0, p.y + p.h)
    velo.addColorStop(0, 'rgb(4 7 12 / 0)')
    velo.addColorStop(1, 'rgb(4 7 12 / 0.92)')
    ctx.fillStyle = velo
    ctx.fillRect(p.x, p.y, p.w, p.h)
    ctx.restore()

    rectanguloRedondo(ctx, p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1, 10)
    ctx.strokeStyle = primera ? paleta.oroVivo : paleta.oro
    ctx.lineWidth = primera ? 2.5 : 1.5
    ctx.stroke()

    // Nombre y serie dentro del marco.
    const margen = 14
    const anchoTexto = p.w - margen * 2
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = paleta.texto
    ctx.font = `700 ${primera ? 21 : 19}px ${paleta.display}`
    ctx.fillText(truncar(medir, carta?.nombre ?? '', anchoTexto), p.x + margen, p.y + p.h - 36)
    ctx.fillStyle = paleta.textoSuave
    ctx.font = `400 13px ${paleta.sans}`
    ctx.fillText(truncar(medir, carta?.anime ?? '', anchoTexto), p.x + margen, p.y + p.h - 16)

    // El sello con el numeral, colgado de la esquina superior izquierda.
    const sello = primera ? 46 : 40
    const sx = p.x - 8
    const sy = p.y - 8
    rectanguloRedondo(ctx, sx, sy, sello, sello, 6)
    ctx.fillStyle = paleta.carmesiVivo
    ctx.fill()
    ctx.fillStyle = paleta.oroPalido
    ctx.font = `700 ${primera ? 26 : 22}px ${paleta.display}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.numeral, sx + sello / 2, sy + sello / 2 + 1)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'

    // La peana: una línea dorada bajo la carta.
    ctx.fillStyle = paleta.oro
    ctx.globalAlpha = primera ? 0.9 : 0.55
    ctx.fillRect(p.x - 6, p.y + p.h + 10, p.w + 12, 3)
    ctx.globalAlpha = 1
  })

  // La marca, abajo a la izquierda.
  ctx.fillStyle = paleta.oroPalido
  ctx.font = `700 22px ${paleta.display}`
  ctx.fillText('AnimeShowdown', 60, H - 44)
  ctx.fillStyle = paleta.textoSuave
  ctx.font = `400 14px ${paleta.sans}`
  ctx.fillText('Haz el tuyo en /juegos', 60, H - 22)
}

/**
 * Crea el PNG del altar: carga las ilustraciones y las fuentes, pinta y
 * devuelve un Blob. `cartas` son las cinco cartas del catálogo, en orden.
 */
export async function crearPng(cartas, { documento = document } = {}) {
  const paleta = paletaDesde(documento.documentElement)
  const [imagenes] = await Promise.all([
    Promise.all(cartas.map((c) => cargarImagen(imagenCarta(c).src))),
    documento.fonts?.load?.(`700 64px ${paleta.display}`).catch(() => {}),
  ])
  const canvas = documento.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = ALTO
  const ctx = canvas.getContext('2d')
  pintar(ctx, cartas, imagenes, paleta)
  return new Promise((resolver, rechazar) => {
    canvas.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo crear la imagen.'))), 'image/png')
  })
}
