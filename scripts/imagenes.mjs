// Ajustes compartidos de las ilustraciones de las cartas: tamaños que se
// generan a partir del original (<ruta>.webp) y su calidad WebP, lectura de
// las dimensiones de un WebP sin decodificarlo y proporción de cada carta.
import { closeSync, openSync, readSync } from 'node:fs'

/**
 * Anchos generados y su calidad. Las ilustraciones son muy recargadas (marcos,
 * textos, destellos): con -sharp_yuv, estas calidades no se distinguen del
 * original al tamaño en que se muestran y pesan la mitad que a calidad 80.
 */
export const TAMANOS = [
  { ancho: 300, calidad: 80 },
  { ancho: 450, calidad: 70 },
  { ancho: 600, calidad: 62 },
]

/** Argumentos de cwebp para generar `destino` de `ancho` px a partir de `original`. */
export function argumentosCwebp(original, destino, { ancho, calidad }) {
  return ['-quiet', '-q', String(calidad), '-m', '6', '-sharp_yuv', '-resize', String(ancho), '0', original, '-o', destino]
}

/**
 * { ancho, alto } de un archivo WebP leyendo solo su cabecera (VP8X, VP8 o
 * VP8L). Lanza un error si no es un WebP reconocible.
 */
export function medidasWebp(archivo) {
  const b = Buffer.alloc(32)
  const fd = openSync(archivo, 'r')
  try {
    readSync(fd, b, 0, b.length, 0)
  } finally {
    closeSync(fd)
  }
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${archivo}: no es WebP`)
  const tipo = b.toString('ascii', 12, 16)
  if (tipo === 'VP8X') return { ancho: 1 + b.readUIntLE(24, 3), alto: 1 + b.readUIntLE(27, 3) }
  if (tipo === 'VP8 ') return { ancho: b.readUInt16LE(26) & 0x3fff, alto: b.readUInt16LE(28) & 0x3fff }
  if (tipo === 'VP8L') {
    const bits = b.readUInt32LE(21)
    return { ancho: 1 + (bits & 0x3fff), alto: 1 + ((bits >> 14) & 0x3fff) }
  }
  throw new Error(`${archivo}: cabecera WebP desconocida (${tipo})`)
}

/** Proporción habitual de las cartas (ancho / alto) y margen para considerarla igual. */
export const PROPORCION_CARTA = 2 / 3
export const TOLERANCIA_PROPORCION = 0.01

/**
 * Valor del campo `ar` de una carta para su ilustración de `medidas`: la
 * proporción ancho / alto con tres decimales, o undefined si es la de
 * siempre (2:3), que no se anota.
 */
export function campoProporcion({ ancho, alto }) {
  const ar = ancho / alto
  return Math.abs(ar - PROPORCION_CARTA) <= TOLERANCIA_PROPORCION ? undefined : Math.round(ar * 1000) / 1000
}
