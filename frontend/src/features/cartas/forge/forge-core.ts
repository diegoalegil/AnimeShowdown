/**
 * forge-core.ts — lógica PURA del ritual de la fragua (La Forja de Sobres #117).
 *
 * Módulo hermano sin React ni DOM: seguro para los inicializadores de estado en
 * StrictMode y para los tests. Nada de Date.now()/Math.random()/new Date(): toda
 * variación es DETERMINISTA por índice (requisito React Compiler + determinismo
 * del repo). El guion de la canvas usaba el vocabulario COMUN/RARA/EPICA/
 * LEGENDARIA; aquí mapeamos el vocabulario REAL del repo (climax NORMAL/TOP/
 * ESPECIAL + el flag reveal.especial) al número de golpes que rompe el lingote.
 */

/** Tiempos EXACTOS del guion (ms). El componente los respeta en sus setTimeout. */
export const TIMING = {
  arrival: 450, // caída del lingote al yunque (ease-lift) + playAcunado
  break: 300, // las mitades se separan +-18px + fade -> handoff al revelado
  penultPause: 250, // pausa dramática del penúltimo golpe (brasas al máximo)
  strikeLock: 120, // bloqueo entre golpes normales (anti-doble-tap)
  heatFromStrike: 3, // desde este golpe suben las brasas y entra el tambor grave
} as const

export type Climax = 'NORMAL' | 'TOP' | 'ESPECIAL'

interface CartaItem {
  climax?: Climax | string
  carta?: { rareza?: string; especialCurada?: boolean }
}
interface RevealLike {
  especial?: boolean
}

/** Rango permitido de golpes (2..5). */
export const MIN_BLOWS = 2
export const MAX_BLOWS = 5
export const DEFAULT_BLOWS = 3

function isEspecialItem(item: CartaItem | undefined): boolean {
  if (!item) return false
  const c = String(item.climax ?? '').toUpperCase()
  if (c === 'ESPECIAL') return true
  return item.carta?.rareza === 'ESPECIAL' || item.carta?.especialCurada === true
}

function isTopItem(item: CartaItem | undefined): boolean {
  return String(item?.climax ?? '').toUpperCase() === 'TOP'
}

/**
 * Número de golpes para romper este sobre, derivado de la MAX rareza presente.
 * Vocabulario real del repo (NO inventado). El backend (CartaService.climaxDe)
 * marca SIEMPRE la última carta del sobre como TOP — o ESPECIAL si el sobre es
 * especial — y el resto NORMAL; por eso en producción el estándar son 4 golpes
 * y los especiales 5. Las ramas 3/2 son defaults DEFENSIVOS (entradas
 * degeneradas / tests con todo NORMAL): no se alcanzan con la API actual.
 *   - sobre con ESPECIAL (climax ESPECIAL / rareza ESPECIAL / reveal.especial) -> 5 (máxima tensión)
 *   - sobre con clímax TOP (la última carta real del sobre)                    -> 4 (estándar real)
 *   - >=2 cartas TODAS NORMAL (no ocurre con la API actual; defensivo)         -> 3
 *   - una sola carta sin clímax (defensivo)                                    -> 2
 *   - vacío / desconocido                                                      -> 3 (default seguro)
 * Siempre dentro de [MIN_BLOWS, MAX_BLOWS].
 */
export function blowsForReveal(cartas: CartaItem[] | undefined, reveal?: RevealLike): number {
  const list = Array.isArray(cartas) ? cartas : []
  let blows: number
  if (reveal?.especial || list.some(isEspecialItem)) {
    blows = MAX_BLOWS // 5
  } else if (list.some(isTopItem)) {
    blows = 4
  } else if (list.length >= 2) {
    blows = DEFAULT_BLOWS // 3
  } else if (list.length === 1) {
    blows = MIN_BLOWS // 2
  } else {
    blows = DEFAULT_BLOWS // 3, default seguro si no hay datos
  }
  return Math.max(MIN_BLOWS, Math.min(MAX_BLOWS, blows))
}

/**
 * Nivel térmico de la fragua según los golpes encajados.
 *   - 'cold'  reservado para estados de error (no usado en el handoff)
 *   - 'max'   en el penúltimo golpe en adelante (brasas al máximo)
 *   - 'high'  desde heatFromStrike
 *   - 'low'   en reposo
 */
export function heatFor(strikes: number, blows: number): 'low' | 'high' | 'max' {
  if (blows >= 3 && strikes >= blows - 1) return 'max'
  if (strikes >= TIMING.heatFromStrike) return 'high'
  return 'low'
}

/**
 * Intensidad 0..1 del golpe `next` (1-based) para escalar playYunque. A baja
 * intensidad el sub queda casi mudo; desde el 3er golpe (heatFromStrike) entra
 * el tambor grave con fuerza creciente.
 */
export function intensityForStrike(next: number): number {
  if (next < TIMING.heatFromStrike) return 0.3
  return Math.min(1, 0.6 + (next - TIMING.heatFromStrike) * 0.2)
}

export interface SparkVector {
  x: number
  y: number
  size: number
  delay: number
  spin: number
}

/**
 * 8 chispas DETERMINISTAS por índice — abanico hacia arriba y afuera. El
 * componente las pinta como custom props inline sobre un pool FIJO de 8 spans;
 * la animación CSS (forge-spark-a/b) las relanza alternando data-fire.
 */
export function sparkVectors(): SparkVector[] {
  const out: SparkVector[] = []
  for (let i = 0; i < 8; i++) {
    const deg = -165 + (i * 150) / 7 // de -165deg a -15deg (sube)
    const rad = (deg * Math.PI) / 180
    const dist = 66 + ((i * 17) % 54)
    out.push({
      x: Math.cos(rad) * dist,
      y: Math.sin(rad) * dist, // negativo = sube
      size: 4 + (i % 4),
      delay: (i % 8) * 9,
      spin: (i % 2 ? 1 : -1) * (120 + ((i * 23) % 160)),
    })
  }
  return out
}
