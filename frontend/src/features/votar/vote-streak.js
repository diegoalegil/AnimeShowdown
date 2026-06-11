// Racha de votos de la sesión (combo). La insignia aparece a partir de
// MIN_STREAK y sube de tramo visual con el contador.
export const MIN_STREAK = 3

export function getStreakTier(total) {
  if (total >= 25) return 'legendaria'
  if (total >= 10) return 'electrica'
  if (total >= 5) return 'oro'
  return 'base'
}
