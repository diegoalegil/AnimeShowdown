/**
 * Sistema de rangos dan/kyū — progresión cultural
 * tradicional japonesa de artes marciales (judo, kendo) y juegos de
 * estrategia (go, shōgi).
 *
 * <p>Estructura:
 * <ul>
 *   <li>10º kyū → 1º kyū (10 niveles iniciales, "estudiante" — 級).</li>
 *   <li>1º dan (shodan, 初段) → 9º dan (kudan, 九段) — "maestro" (段).</li>
 * </ul>
 *
 * <p>Progresión calculada como puntos = votos + predicciones acertadas × 3
 * + badges desbloqueados × 10. Cada rango tiene su umbral, y la diferencia
 * entre rangos crece exponencialmente (kyū rápidos al inicio, dan muy
 * lentos al final). Esto refleja la realidad: subir de 10º kyū a 9º kyū
 * es trivial; subir de 8º a 9º dan toma décadas.
 */

export const RANGOS = [
  // Kyū (estudiante) — orden inverso: 10º es el más bajo
  { id: 'k10', umbral: 0, nombre: '10º kyū', kanji: '十級', tipo: 'kyu' },
  { id: 'k9', umbral: 10, nombre: '9º kyū', kanji: '九級', tipo: 'kyu' },
  { id: 'k8', umbral: 30, nombre: '8º kyū', kanji: '八級', tipo: 'kyu' },
  { id: 'k7', umbral: 60, nombre: '7º kyū', kanji: '七級', tipo: 'kyu' },
  { id: 'k6', umbral: 100, nombre: '6º kyū', kanji: '六級', tipo: 'kyu' },
  { id: 'k5', umbral: 200, nombre: '5º kyū', kanji: '五級', tipo: 'kyu' },
  { id: 'k4', umbral: 350, nombre: '4º kyū', kanji: '四級', tipo: 'kyu' },
  { id: 'k3', umbral: 550, nombre: '3º kyū', kanji: '三級', tipo: 'kyu' },
  { id: 'k2', umbral: 800, nombre: '2º kyū', kanji: '二級', tipo: 'kyu' },
  { id: 'k1', umbral: 1200, nombre: '1º kyū', kanji: '一級', tipo: 'kyu' },
  // Dan (maestro)
  { id: 'd1', umbral: 1800, nombre: 'Shodan', kanji: '初段', tipo: 'dan' },
  { id: 'd2', umbral: 2700, nombre: 'Nidan', kanji: '二段', tipo: 'dan' },
  { id: 'd3', umbral: 4000, nombre: 'Sandan', kanji: '三段', tipo: 'dan' },
  { id: 'd4', umbral: 6000, nombre: 'Yondan', kanji: '四段', tipo: 'dan' },
  { id: 'd5', umbral: 9000, nombre: 'Godan', kanji: '五段', tipo: 'dan' },
  { id: 'd6', umbral: 13500, nombre: 'Rokudan', kanji: '六段', tipo: 'dan' },
  { id: 'd7', umbral: 20000, nombre: 'Shichidan', kanji: '七段', tipo: 'dan' },
  { id: 'd8', umbral: 30000, nombre: 'Hachidan', kanji: '八段', tipo: 'dan' },
  { id: 'd9', umbral: 45000, nombre: 'Kudan', kanji: '九段', tipo: 'dan' },
]

/**
 * Calcula los puntos totales de progresión a partir de las stats del
 * usuario.
 */
export function calcularPuntos({
  votosTotales = 0,
  prediccionesAcertadas = 0,
  badgesDesbloqueados = 0,
} = {}) {
  return (
    Number(votosTotales) +
    Number(prediccionesAcertadas) * 3 +
    Number(badgesDesbloqueados) * 10
  )
}

/**
 * Devuelve el rango actual + el siguiente + progreso (0-1) hasta el
 * siguiente. Si está en kudan (9º dan), siguiente = null y progreso = 1.
 */
export function rangoDe(puntos) {
  let actual = RANGOS[0]
  for (const r of RANGOS) {
    if (puntos >= r.umbral) actual = r
    else break
  }
  const idx = RANGOS.indexOf(actual)
  const siguiente = idx + 1 < RANGOS.length ? RANGOS[idx + 1] : null
  let progreso = 1
  if (siguiente) {
    progreso = (puntos - actual.umbral) / (siguiente.umbral - actual.umbral)
    progreso = Math.max(0, Math.min(1, progreso))
  }
  return { actual, siguiente, progreso, puntos }
}
