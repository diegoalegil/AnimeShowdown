// Helpers puros de la Crónica de la federación. Viven fuera del .jsx para
// que el archivo del componente solo exporte componentes (react-refresh) y
// para poder testearlos sin React.

/**
 * Clave estable POR CONTENIDO (nunca por índice: los items nuevos del push
 * entran por arriba y un índice desplazado re-montaría toda la lista dentro
 * de AnimatePresence). Colisiones residuales se resuelven en clavesUnicas.
 */
export function claveEvento(item) {
  const p = item.payload || {}
  const detalle =
    p.personajeSlug ?? p.torneoSlug ?? p.seguidoUsername ?? p.nombre ?? p.torneoNombre ?? ''
  return [item.tipo, item.fecha, p.autorUsername ?? '', detalle].join('|')
}

/** Empareja cada item con una clave única (sufija repeticiones exactas). */
export function clavesUnicas(items) {
  const vistos = new Map()
  return items.map((item) => {
    const base = claveEvento(item)
    const n = vistos.get(base) ?? 0
    vistos.set(base, n + 1)
    return { item, key: n === 0 ? base : `${base}#${n}` }
  })
}

/** Un evento es "tinta fresca" si acaba de pasar: punto cian + sello ya
    estampado (el pop de entrada ya lo anima entero). */
export function esTintaFresca(iso, ahora = Date.now(), umbralMs = 120_000) {
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return false
  return ahora - ts < umbralMs
}

export function fechaRelativa(iso, ahora = Date.now()) {
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''
  const diffMin = Math.round((ahora - ts) / 60000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `hace ${diffH} h`
  const diffD = Math.round(diffH / 24)
  if (diffD === 1) return 'ayer'
  if (diffD < 30) return `hace ${diffD} días`
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

/** Tres bloques de la línea de tiempo: hoy / ayer / días anteriores. */
export function agrupaPorDia(entradas, ahora = new Date()) {
  const hoy = []
  const ayer = []
  const antes = []
  const inicioHoy = new Date(ahora).setHours(0, 0, 0, 0)
  const inicioAyer = inicioHoy - 86_400_000
  for (const entrada of entradas) {
    const ts = new Date(entrada.item.fecha).getTime()
    if (ts >= inicioHoy) hoy.push(entrada)
    else if (ts >= inicioAyer) ayer.push(entrada)
    else antes.push(entrada)
  }
  return { hoy, ayer, antes }
}
