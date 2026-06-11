// Estado y coreografía del rito de iniciación post-registro (la placa del
// nuevo luchador). El componente InitiationRite consume esto; vive aparte
// para que RegisterPage pueda decidir si toca ceremonia sin montar nada y
// para que los timings sean testables sin React.

const STORAGE_KEY = 'animeshowdown.rito-acunado.v1'

/** ¿Toca ceremonia? (one-shot por navegador). */
export function shouldRunInitiationRite() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

export function markInitiationRiteSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* sin storage no hay memoria del rito; mejor repetirlo que romper */
  }
}

// Presupuesto total ≤ 2.500 ms hasta el inicio de la salida. El stagger del
// acuñado se autoajusta al largo del username para no romperlo: con 8
// caracteres el hanko cae a ~1.100 ms; con 20, a ~2.480 ms.
export const RITE_T = {
  plateIn: 240,
  hairlineDelay: 160,
  hairlineDur: 1300,
  charsStart: 340,
  charDur: 260,
  staggerMin: 40,
  staggerMax: 60,
  hankoLag: 80,
  hankoDur: 420,
  hold: 300,
  budget: 2500,
}

/** Timings derivados del nº de caracteres, dentro del presupuesto. */
export function riteTimings(charCount) {
  const n = Math.max(1, charCount)
  const free =
    RITE_T.budget - RITE_T.charsStart - RITE_T.charDur - RITE_T.hankoLag - RITE_T.hankoDur - RITE_T.hold
  const stagger =
    n === 1
      ? 0
      : Math.max(RITE_T.staggerMin, Math.min(RITE_T.staggerMax, Math.floor(free / (n - 1))))
  const hankoAt = RITE_T.charsStart + (n - 1) * stagger + RITE_T.charDur + RITE_T.hankoLag
  return {
    stagger,
    hankoAt,
    // El golpe de acuñado suena cuando el sello asienta, no cuando arranca.
    sfxAt: hankoAt + Math.round(RITE_T.hankoDur * 0.55),
    exitAt: hankoAt + RITE_T.hankoDur + RITE_T.hold,
  }
}
