// Codificador PNG mínimo (gris + alfa, 8 bits) para las texturas generadas
// por los scripts. Sin dependencias: solo node:zlib.
import { crc32, deflateSync } from 'node:zlib'

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/**
 * PNG en gris + alfa. `gray` y `alpha` son Uint8Array de width × height,
 * fila a fila.
 */
export function pngGrisAlfa(width, height, gray, alpha) {
  const raw = Buffer.alloc(height * (width * 2 + 1))
  for (let y = 0; y < height; y++) {
    const row = y * (width * 2 + 1)
    raw[row] = 0 // sin filtro
    for (let x = 0; x < width; x++) {
      raw[row + 1 + x * 2] = gray[y * width + x]
      raw[row + 2 + x * 2] = alpha[y * width + x]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 4 // gris + alfa
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
