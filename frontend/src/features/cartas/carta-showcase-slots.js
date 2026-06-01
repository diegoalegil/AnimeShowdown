const SLOT_LABELS = {
  PERFIL: 'Perfil',
  DUEL_SKIN: 'Skin de duelo',
  SALON_1: 'Salon I',
  SALON_2: 'Salon II',
  SALON_3: 'Salon III',
}

export function cartaShowcaseSlotLabel(slot) {
  return SLOT_LABELS[slot] || slot
}
