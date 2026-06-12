/**
 * Reservas de altura de las secciones de la home (medidas reales @390px
 * redondeadas a decenas, en el orden real de InicioPage: combate estelar →
 * pulso → misión diaria → top10 → retos → torneos → universos).
 *
 * FUENTE ÚNICA anti-CLS: PageSkeleton pinta sus bloques fantasma con estas
 * medidas y InicioPage las usa para los minHeight de sus LazyOnView — así
 * el skeleton y las reservas reales no pueden divergir en el próximo
 * rediseño. Módulo propio (no PageSkeleton.jsx) por la regla react-refresh:
 * los ficheros de componentes solo exportan componentes.
 */
export const HOME_SECTION_RESERVES = [
  { id: 'combate-estelar', px: 960 },
  { id: 'pulse', px: 1180 },
  { id: 'daily-mission', px: 650 },
  { id: 'ranking', px: 820 },
  { id: 'daily-trials', px: 620 },
  { id: 'tournaments', px: 520 },
  { id: 'anime-universes', px: 520 },
]

export function homeSectionReserve(id) {
  return HOME_SECTION_RESERVES.find((block) => block.id === id)?.px ?? 0
}
