import { SOBRE_ABIERTO_EVENT, VOTO_REGISTRADO_EVENT } from '../../lib/app-events'

/**
 * Núcleo puro del combate guiado: gate, pasos y geometría del recorte.
 * Separado del componente para testearlo sin montar React y para que
 * OnboardingGate decida sin cargar el chunk del tour.
 */

export const GATE_KEY = 'onboarding.v1'

/** Padding del hueco del spotlight alrededor del target real. */
export const PAD = 10

export function getGate() {
  try {
    return localStorage.getItem(GATE_KEY)
  } catch {
    // Sin storage (incógnito duro) no insistimos: tratar como hecho.
    return 'done'
  }
}

export function setGate(value) {
  try {
    localStorage.setItem(GATE_KEY, value)
  } catch {
    /* incógnito */
  }
}

/**
 * Polígono-anillo: telón completo con hueco rectangular. El nº de vértices
 * es constante en todos los pasos → la transition de clip-path interpola
 * el morph entre recortes. Sin rect (target ausente) el hueco colapsa.
 */
export function ringClip(r) {
  if (!r) {
    return 'polygon(0 0, 0 100%, 0px 100%, 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 100%, 100% 100%, 100% 0)'
  }
  const x = Math.round(r.x)
  const y = Math.round(r.y)
  const x2 = Math.round(r.x + r.w)
  const y2 = Math.round(r.y + r.h)
  return `polygon(0 0, 0 100%, ${x}px 100%, ${x}px ${y}px, ${x2}px ${y}px, ${x2}px ${y2}px, ${x}px ${y2}px, ${x}px 100%, 100% 100%, 100% 0)`
}

/**
 * Los 4 pasos del combate guiado. route/target pueden ser funciones del
 * contexto acumulado (el slug votado en el paso 1 viaja al deep-link del 2).
 * El target del paso 1 reutiliza el ancla data-votar-arena que VoteArena
 * ya expone — sin instrumentación nueva allí.
 */
export const TOUR_STEPS = [
  {
    id: 'duelo',
    kanji: '戦',
    title: 'Tu primer duelo decide.',
    desc: 'Toca al que ganaría. Tu voto mueve el ELO global ahora mismo.',
    route: '/votar',
    target: '[data-votar-arena]',
    advanceOn: VOTO_REGISTRADO_EVENT,
  },
  {
    id: 'ranking',
    kanji: '動',
    title: 'El ranking ya se movió.',
    desc: 'Ese voto es tuyo. Cada duelo reordena la tabla en vivo.',
    route: () => '/ranking?tab=elo',
    target: (ctx) => `[data-tour="rank-row"][data-slug="${ctx.votedSlug ?? ''}"]`,
    advanceOn: null,
  },
  {
    id: 'moneda',
    kanji: '金',
    title: 'Tu primera moneda.',
    desc: 'Votar paga: tu primer voto te acaba de acreditar monedas.',
    route: null,
    target: '[data-tour="saldo-chip"]',
    advanceOn: null,
  },
  {
    id: 'sobre',
    kanji: '封',
    title: 'El sello te espera.',
    desc: '4 cartas + 1 especial garantizada. Ábrelo: es tu regalo de bienvenida.',
    route: '/',
    target: '[data-tour="sobre-bienvenida"]',
    advanceOn: SOBRE_ABIERTO_EVENT,
  },
]
