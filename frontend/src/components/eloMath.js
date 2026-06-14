/**
 * eloMath.js — fórmulas ELO de «El tratado del ELO» (/metodologia-elo).
 * Módulo .js hermano (sin componentes) para convivir con react-refresh.
 *
 * ⚠️ FUENTE DE VERDAD: estas funciones reproducen la fórmula ELO estándar
 * que describe la metodología del producto. El cliente NO tenía la fórmula
 * expuesta en el momento de la integración: si el repo llega a exponer la
 * fórmula real (p. ej. lib/elo.js), IMPORTARLA desde ahí y borrar este
 * archivo. Si el backend cambia la escala logística (400) o el redondeo,
 * esto DEBE actualizarse a la vez. La demo es ILUSTRATIVA: enseña la
 * matemática estándar descrita en el texto, no una fórmula inventada.
 */

/**
 * Expectativa de victoria de A frente a B (fórmula ELO estándar).
 * @param {number} ratingA — puntuación ELO del personaje A
 * @param {number} ratingB — puntuación ELO del personaje B
 * @returns {number} probabilidad esperada de victoria de A, en (0, 1)
 */
export function eloExpectation(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

/**
 * Puntos que se mueve un personaje tras el duelo.
 * @param {number} kFactor — factor K usado en la demostración (el valor real
 *   del producto vive en el backend; aquí es un valor ilustrativo declarado)
 * @param {0|1} score — resultado del duelo para ese personaje
 * @param {number} expectation — expectativa previa (eloExpectation)
 * @returns {number} delta de puntos (positivo o negativo, sin redondear)
 */
export function eloDelta(kFactor, score, expectation) {
  return kFactor * (score - expectation)
}
