/**
 * Variantes de la acuñación de medalla por rareza (MedalMint), en módulo
 * hermano: lo consumen el componente y BadgeUnlockListener sin arrastrar
 * exports no-componente al archivo JSX (react-refresh/only-export-components).
 *
 * Acumulativas: common 5 manchas sumi-e carmesí · rare añade la 6.ª y el
 * anillo en oro pleno · epic suma 2 manchas cian · legendary añade la 2.ª
 * onda dorada y el barrido más largo.
 */
export const RARITY = {
  common: { label: 'común', blobs: 5, electric: false, wave2: false, sweep: 0.45, fullGoldRing: false },
  rare: { label: 'rara', blobs: 6, electric: false, wave2: false, sweep: 0.55, fullGoldRing: true },
  epic: { label: 'épica', blobs: 6, electric: true, wave2: false, sweep: 0.55, fullGoldRing: true },
  legendary: { label: 'legendaria', blobs: 6, electric: true, wave2: true, sweep: 0.6, fullGoldRing: true },
}

/** Rareza numérica del backend (1-5, escalera TCG) → clave de variante. */
export function rarezaToKey(rareza) {
  if (rareza === 5) return 'legendary'
  if (rareza === 4) return 'epic'
  if (rareza === 3) return 'rare'
  return 'common'
}
