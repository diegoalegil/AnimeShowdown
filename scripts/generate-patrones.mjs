#!/usr/bin/env node
// Genera las teselas de los motivos tradicionales que usan los sobres:
//
//   public/seigaiha.png  olas (青海波) para el envoltorio de papel
//   public/asanoha.png   hojas de cáñamo (麻の葉) para el dorso de las cartas
//
// Son máscaras: solo importa el alfa (las líneas). El color lo pone el CSS
// con un token, así el motivo sigue a la paleta. Se dibujan al doble de
// resolución (se muestran a la mitad) y con supermuestreo para suavizar el
// borde. Deterministas: siempre producen el mismo archivo.
//
//   node scripts/generate-patrones.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pngGrisAlfa } from './png.mjs'

const MUESTRAS = 4 // supermuestreo por eje

/**
 * Pinta una tesela: `tinta(x, y)` devuelve 0..1 (cuánta línea hay en ese
 * punto) y se promedia sobre MUESTRAS × MUESTRAS puntos por píxel.
 */
function tesela(ancho, alto, tinta) {
  const gray = new Uint8Array(ancho * alto)
  const alpha = new Uint8Array(ancho * alto)
  for (let py = 0; py < alto; py++) {
    for (let px = 0; px < ancho; px++) {
      let suma = 0
      for (let sy = 0; sy < MUESTRAS; sy++) {
        for (let sx = 0; sx < MUESTRAS; sx++) {
          suma += tinta(px + (sx + 0.5) / MUESTRAS, py + (sy + 0.5) / MUESTRAS)
        }
      }
      alpha[py * ancho + px] = Math.round((suma / (MUESTRAS * MUESTRAS)) * 255)
    }
  }
  return pngGrisAlfa(ancho, alto, gray, alpha)
}

const linea = (distancia, grosor) => (Math.abs(distancia) <= grosor / 2 ? 1 : 0)

// ---------------------------------------------------------------------------
// Seigaiha: abanicos de radio R en filas separadas R/2, cada fila desplazada
// R en horizontal. Cada fila tapa la parte baja de la anterior, así que en
// cada punto manda el abanico de la fila más baja que lo contiene.
// ---------------------------------------------------------------------------
function seigaiha() {
  const R = 48
  const ancho = 2 * R
  const alto = R
  const anillos = [0.97, 0.76, 0.55, 0.34, 0.13].map((f) => f * R)
  const grosor = 2.2

  return tesela(ancho, alto, (x, y) => {
    const kMax = Math.ceil((y + R) / (R / 2))
    const kMin = Math.floor((y - R) / (R / 2))
    for (let k = kMax; k >= kMin; k--) {
      const cy = (k * R) / 2
      const desfase = ((k % 2) + 2) % 2 === 1 ? R : 0
      // Centro más cercano de esa fila (periodo 2R en horizontal).
      const m = Math.round((x - desfase) / (2 * R))
      for (const cx of [desfase + (m - 1) * 2 * R, desfase + m * 2 * R, desfase + (m + 1) * 2 * R]) {
        const d = Math.hypot(x - cx, y - cy)
        if (d < R) return Math.max(...anillos.map((r) => linea(d - r, grosor)))
      }
    }
    return 0
  })
}

// ---------------------------------------------------------------------------
// Asanoha: la red de triángulos equiláteros y, en cada triángulo, las líneas
// de su centro a los tres vértices.
// ---------------------------------------------------------------------------
function asanoha() {
  const a = 56 // lado del triángulo
  const ancho = a
  const alto = 97 // ≈ a·√3, redondeado para que la tesela encaje en píxeles
  const h = alto / 2
  const grosor = 1.8

  const vertice = (i, j) => [i * a + (j % 2 !== 0 ? a / 2 : 0), j * h]
  const segmentos = []
  for (let j = -2; j <= 4; j++) {
    for (let i = -2; i <= 3; i++) {
      const p = vertice(i, j)
      const derecha = vertice(i + 1, j)
      // Vértices de la fila de abajo a izquierda y derecha de p.
      const abajoIzq = j % 2 !== 0 ? vertice(i, j + 1) : vertice(i - 1, j + 1)
      const abajoDer = j % 2 !== 0 ? vertice(i + 1, j + 1) : vertice(i, j + 1)
      segmentos.push([p, derecha], [p, abajoIzq], [p, abajoDer])
      // Triángulo que apunta hacia abajo (p, derecha, abajoDer) y el que
      // apunta hacia arriba (p, abajoIzq, abajoDer): radios desde su centro.
      for (const tri of [
        [p, derecha, abajoDer],
        [p, abajoIzq, abajoDer],
      ]) {
        const c = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3]
        for (const v of tri) segmentos.push([c, v])
      }
    }
  }

  const distanciaSegmento = (x, y, [[x1, y1], [x2, y2]]) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const t = Math.min(Math.max(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy), 0), 1)
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
  }

  return tesela(ancho, alto, (x, y) => {
    for (const s of segmentos) if (distanciaSegmento(x, y, s) <= grosor / 2) return 1
    return 0
  })
}

const publico = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
for (const [nombre, png] of [
  ['seigaiha.png', seigaiha()],
  ['asanoha.png', asanoha()],
]) {
  writeFileSync(join(publico, nombre), png)
  console.log(`${nombre}: ${png.length} bytes`)
}
