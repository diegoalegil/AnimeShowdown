// kumite-core.js — guión y contrato del KUMITE DE INICIACIÓN (#122).
//
// Módulo PURO (cero React, cero DOM): el orquestador TrainingKumite importa
// KUMITE_STEPS para pintar el progreso de cordones, anunciar cada ejercicio
// con texto real (a11y) y decidir cuándo el cinturón está completo. La
// validación de cada gesto vive en los componentes (es DOM-específica); aquí
// solo está el guión declarativo + los helpers de progreso, así es testeable
// en aislamiento y sin entorno de navegador.
//
// Persistencia: el kumite NO define su propia clave de localStorage. Reusa la
// del onboarding existente (GATE_KEY = 'onboarding.v1' en ../tour-core.js) para
// no duplicar el gate ni reaparecer tras "ya entrené". El padre
// (FirstDuelTourGate) sigue siendo el dueño de esa clave.

/**
 * @typedef {object} KumiteStep
 * @property {'voto'|'empate'|'busqueda'|'archivo'} id  Id estable del ejercicio.
 * @property {number} ordinal   1-based, para "ejercicio N de 4" y el ol aria.
 * @property {string} kanji     Kanji-concepto que TRAZA el sensei (significado real).
 * @property {string} titulo    Nombre del ejercicio (visible).
 * @property {string} concepto  Glosa corta del concepto (la "lección" del sensei).
 * @property {string} instruccion  Gesto esperado, en TEXTO REAL (a11y: no solo animación).
 * @property {string} cordon    Etiqueta del cordón que se anuda al superarlo.
 */

/**
 * Los 4 ejercicios del kumite, en orden. Kanji con significado (nunca relleno):
 *  · 票 voto/papeleta · 同 igual (empate) · 索 buscar · 記 registro/archivo.
 * @type {ReadonlyArray<KumiteStep>}
 */
export const KUMITE_STEPS = Object.freeze([
  {
    id: 'voto',
    ordinal: 1,
    kanji: '票',
    titulo: 'El voto',
    concepto: 'Cada duelo se decide con un voto. El tuyo cuenta igual que el de todos.',
    instruccion: 'Elige la carta que prefieras y tócala para emitir tu voto.',
    cordon: 'Cordón del voto',
  },
  {
    id: 'empate',
    ordinal: 2,
    kanji: '同',
    titulo: 'El empate',
    concepto: 'Cuando no puedes decidir, la balanza es una respuesta honesta.',
    instruccion: 'Pulsa la balanza del centro para declarar un empate.',
    cordon: 'Cordón del equilibrio',
  },
  {
    id: 'busqueda',
    ordinal: 3,
    kanji: '索',
    titulo: 'La búsqueda',
    concepto: 'Miles de personajes. Dos letras bastan para encontrar al tuyo.',
    instruccion: 'Abre la paleta (⌘K o el botón) y escribe dos letras para encontrar a un personaje.',
    cordon: 'Cordón de la búsqueda',
  },
  {
    id: 'archivo',
    ordinal: 4,
    kanji: '記',
    titulo: 'El archivo',
    concepto: 'Todo lo que votas deja rastro: tu ranking personal se escribe solo.',
    instruccion: 'Abre tu primer rastro en el ranking personal para terminar el entrenamiento.',
    cordon: 'Cordón del archivo',
  },
])

/** Sello hanko de la ceremonia final: 誓 = juramento/voto del cinturón. */
export const CEREMONIA_SELLO = '誓'

/** Nº total de cordones (= ejercicios). El cinturón se ata al anudarlos todos. */
export const TOTAL_CORDONES = KUMITE_STEPS.length

const STEP_IDS = Object.freeze(KUMITE_STEPS.map((s) => s.id))

/** ¿Es `id` un ejercicio válido del kumite? */
export function esPasoValido(id) {
  return STEP_IDS.includes(id)
}

/**
 * Siguiente ejercicio pendiente dado el set de completados (Set o array de ids).
 * Devuelve el primer KUMITE_STEPS no completado, o null si el cinturón está listo.
 * @param {Iterable<string>} completados
 * @returns {KumiteStep | null}
 */
export function siguientePaso(completados) {
  const hechos = new Set(completados)
  return KUMITE_STEPS.find((s) => !hechos.has(s.id)) ?? null
}

/**
 * ¿Están los 4 ejercicios superados? Cuenta SOLO ids válidos (defensivo ante
 * duplicados o ruido en el set persistido).
 * @param {Iterable<string>} completados
 */
export function kumiteCompleto(completados) {
  const hechos = new Set([...completados].filter(esPasoValido))
  return hechos.size === TOTAL_CORDONES
}

/**
 * Nº de cordones anudados (ejercicios válidos superados), saturado a TOTAL.
 * @param {Iterable<string>} completados
 */
export function cordonesAnudados(completados) {
  const hechos = new Set([...completados].filter(esPasoValido))
  return Math.min(hechos.size, TOTAL_CORDONES)
}
