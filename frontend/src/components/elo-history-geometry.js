/**
 * Geometría pura del EloHistoryChart — separada del componente para poder
 * testearla sin montar React (geometría pura en su propio módulo).
 */
export const W = 600
export const H = 170
export const PAD_X = 10
export const PAD_TOP = 36
export const PAD_BOT = 16

/**
 * Proyecta la serie de votos acumulados al viewBox del chart.
 *
 * <p>Devuelve null si no hay serie dibujable (<2 puntos o serie plana —
 * un personaje sin actividad no merece un chart vacío, igual que en v1).
 * `peak` es el índice del PRIMER máximo; `subeAlFinal` compara el último
 * punto con el de hace 5 días y decide el gradiente carmesí→oro del trazo.
 */
export function computarGeometria(data) {
  if (!data || data.length < 2) return null
  let min = data[0].votosAcumulados
  let max = data[0].votosAcumulados
  for (const p of data) {
    if (p.votosAcumulados < min) min = p.votosAcumulados
    if (p.votosAcumulados > max) max = p.votosAcumulados
  }
  if (max - min === 0) return null
  const rango = max - min
  const n = data.length
  const pts = data.map((p, i) => ({
    x: PAD_X + (i * (W - PAD_X * 2)) / (n - 1),
    y: H - PAD_BOT - ((p.votosAcumulados - min) / rango) * (H - PAD_TOP - PAD_BOT),
    votos: p.votosAcumulados,
    fecha: p.fecha,
  }))
  const linea = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const area =
    `M ${pts[0].x.toFixed(1)} ${H - PAD_BOT} ` +
    pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
    ` L ${pts[n - 1].x.toFixed(1)} ${H - PAD_BOT} Z`
  let peak = 0
  pts.forEach((p, i) => {
    if (p.votos > pts[peak].votos) peak = i
  })
  const subeAlFinal = pts[n - 1].votos >= pts[Math.max(0, n - 5)].votos
  return {
    pts,
    linea,
    area,
    peak,
    subeAlFinal,
    inicial: pts[0].votos,
    actual: pts[n - 1].votos,
    delta: pts[n - 1].votos - pts[0].votos,
  }
}
