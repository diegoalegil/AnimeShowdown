// Las reglas del Oráculo: la partida es un objeto inmutable que avanza con
// responder() y continuar(). El jugador sella un personaje; el oráculo
// pregunta sí/no eligiendo la pregunta que más parte a los candidatos,
// descarta con cada respuesta y apuesta cuando está seguro o se le acaban
// las preguntas. Las respuestas se comprueban contra los datos del sellado:
// una mentira termina la partida.
import { elegirUno } from '../comun/azar.js'
import { PERSONAJES, popularidad } from '../comun/cartas.js'
import { banco as bancoDelCatalogo } from './preguntas.js'

export const MAX_PREGUNTAS = 12
export const MAX_NO_SE = 2
export const MAX_APUESTAS = 2
export const UMBRAL_CONFIANZA = 0.78
// Preguntas que compiten por salir: las que rinden al menos este tanto de la
// mejor, hasta un máximo. Con poco margen el oráculo acierta casi siempre;
// con este, un jugador que mida sus «no sé» y elija bien tiene opciones.
const MARGEN_EMPATE = 0.4
const MAX_EMPATADAS = 10

export const RESPUESTAS = ['si', 'no', 'nose']

/**
 * Peso de un candidato: cuanto más querido, más probable como apuesta.
 * Escala logarítmica para que los grandes no aplasten a la cola larga.
 */
export const peso = (carta) => Math.log10(popularidad(carta) + 10)

/** Confianza del oráculo en su mejor candidato (0..1): su peso sobre el total. */
export function confianza(candidatos) {
  if (!candidatos.length) return 0
  let total = 0
  let mejor = 0
  for (const c of candidatos) {
    const p = peso(c)
    total += p
    if (p > mejor) mejor = p
  }
  return total ? mejor / total : 0
}

/** El candidato por el que apuesta el oráculo: el de más peso (empates, el primero). */
export function mejorCandidato(candidatos) {
  let mejor
  let maximo = -Infinity
  for (const c of candidatos) {
    const p = peso(c)
    if (p > maximo) {
      maximo = p
      mejor = c
    }
  }
  return mejor
}

/**
 * Lo que se espera descartar con una pregunta (0..0.5): reparto del peso
 * de los candidatos entre sí, no y no se sabe. Los «no se sabe» sobreviven
 * a cualquier respuesta, así que restan. 0 si no parte el grupo.
 */
export function ganancia(pregunta, candidatos) {
  let si = 0
  let no = 0
  let nulo = 0
  for (const c of candidatos) {
    const v = pregunta.aplica(c)
    const p = peso(c)
    if (v === true) si += p
    else if (v === false) no += p
    else nulo += p
  }
  const total = si + no + nulo
  if (!si || !no || !total) return 0
  const pSi = (si + nulo / 2) / total
  const pNo = (no + nulo / 2) / total
  const esperado = pSi * (si + nulo) + pNo * (no + nulo)
  return 1 - esperado / total
}

/**
 * La siguiente pregunta: entre las no hechas, una de las que más parten a
 * los candidatos (hay un poco de azar entre las casi empatadas para que
 * dos partidas no sean iguales). undefined si ninguna aporta nada.
 */
export function elegirPregunta(banco, candidatos, hechas, rng = Math.random) {
  const utiles = []
  for (const pregunta of banco) {
    if (hechas.has(pregunta.id)) continue
    const g = ganancia(pregunta, candidatos)
    if (g > 0) utiles.push({ pregunta, g })
  }
  if (!utiles.length) return undefined
  utiles.sort((a, b) => b.g - a.g)
  const corte = utiles[0].g * MARGEN_EMPATE
  const finalistas = utiles.filter((u) => u.g >= corte).slice(0, MAX_EMPATADAS)
  return elegirUno(finalistas, rng).pregunta
}

/** Candidatos que siguen en pie tras una respuesta (los «no se sabe» siempre siguen). */
export function filtrar(candidatos, pregunta, respuesta) {
  if (respuesta === 'nose') return candidatos
  const buscado = respuesta === 'si'
  return candidatos.filter((c) => {
    const v = pregunta.aplica(c)
    return v === null || v === buscado
  })
}

/**
 * Si la respuesta es sincera para el personaje sellado. Cuando el dato
 * falta, vale cualquier respuesta; «no sé» siempre vale.
 */
export function esSincera(pregunta, sellado, respuesta) {
  if (respuesta === 'nose') return true
  const v = pregunta.aplica(sellado)
  if (v === null) return true
  return v === (respuesta === 'si')
}

/** Ciclo de respiración del aura: 4 s lejos, 1,5 s al borde de la apuesta. */
export function cicloAura(conf) {
  const c = Math.min(1, Math.max(0, conf))
  return `${(4 - 2.5 * c).toFixed(2)}s`
}

const debeApostar = (partida) =>
  partida.candidatos.length <= 1 ||
  confianza(partida.candidatos) >= UMBRAL_CONFIANZA ||
  partida.respuestas.length >= MAX_PREGUNTAS

/**
 * Empieza una partida con el personaje sellado. Fases:
 *   'pregunta'  hay una `pregunta` que responder
 *   'veredicto' el oráculo ha apostado (`apuesta`, `acierto`); si no hay
 *               `resultado`, continuar() sigue la partida
 *   'fin'       con `resultado`: 'adivinado' (el oráculo gana), 'enganado'
 *               (el jugador gana) o 'mentira' (el jugador mintió, `mentira`
 *               dice en qué)
 */
export function nuevaPartida(sellado, { banco = bancoDelCatalogo(), candidatos = PERSONAJES, rng = Math.random } = {}) {
  const partida = {
    sellado,
    banco,
    candidatos,
    respuestas: [],
    hechas: new Set(),
    noSe: 0,
    apuestas: [],
    pregunta: undefined,
    apuesta: undefined,
    acierto: undefined,
    resultado: null,
    mentira: null,
    fase: 'pregunta',
  }
  return siguientePaso(partida, rng)
}

/** Pregunta siguiente o, si toca, apuesta. */
function siguientePaso(partida, rng) {
  const pregunta = debeApostar(partida) ? undefined : elegirPregunta(partida.banco, partida.candidatos, partida.hechas, rng)
  if (!pregunta) return apostar(partida)
  return { ...partida, fase: 'pregunta', pregunta }
}

/** El oráculo nombra su apuesta y la partida pasa al veredicto. */
function apostar(partida) {
  const apuesta = mejorCandidato(partida.candidatos)
  if (!apuesta) return { ...partida, fase: 'fin', pregunta: undefined, resultado: 'enganado' }
  const acierto = apuesta.id === partida.sellado.id
  const apuestas = [...partida.apuestas, apuesta]
  const agotadas = apuestas.length >= MAX_APUESTAS
  return {
    ...partida,
    fase: acierto || agotadas ? 'fin' : 'veredicto',
    pregunta: undefined,
    apuesta,
    acierto,
    apuestas,
    candidatos: acierto ? partida.candidatos : partida.candidatos.filter((c) => c.id !== apuesta.id),
    resultado: acierto ? 'adivinado' : agotadas ? 'enganado' : null,
  }
}

/**
 * Responde a la pregunta en curso ('si' | 'no' | 'nose'). Una mentira
 * termina la partida; «no sé» no descarta nada y tiene un tope.
 */
export function responder(partida, respuesta, rng = Math.random) {
  if (partida.fase !== 'pregunta' || !RESPUESTAS.includes(respuesta)) return partida
  if (respuesta === 'nose' && partida.noSe >= MAX_NO_SE) return partida
  const { pregunta } = partida
  const hechas = new Set(partida.hechas).add(pregunta.id)
  const respuestas = [...partida.respuestas, { pregunta, respuesta }]
  if (!esSincera(pregunta, partida.sellado, respuesta)) {
    return {
      ...partida,
      fase: 'fin',
      pregunta: undefined,
      hechas,
      respuestas,
      resultado: 'mentira',
      mentira: { pregunta, respuesta, verdad: pregunta.aplica(partida.sellado) },
    }
  }
  const avanzada = {
    ...partida,
    hechas,
    respuestas,
    noSe: partida.noSe + (respuesta === 'nose' ? 1 : 0),
    candidatos: filtrar(partida.candidatos, pregunta, respuesta),
  }
  return siguientePaso(avanzada, rng)
}

/** Tras una apuesta fallida que no cierra la partida: el oráculo sigue preguntando o apuesta de nuevo. */
export function continuar(partida, rng = Math.random) {
  if (partida.fase !== 'veredicto') return partida
  return siguientePaso({ ...partida, apuesta: undefined, acierto: undefined }, rng)
}

/** true si la ronda terminó con victoria del jugador (el oráculo no acertó, sin mentir). */
export const ganada = (partida) => partida.resultado === 'enganado'
