/**
 * observatory-core.js — proyección DETERMINISTA del ranking a un cielo nocturno
 * y la aritmética temporal del «escrutador de mareas». Módulo PURO, hermano de
 * <MetaObservatory>: sin React, sin DOM, sin `Math.random` ni `Date`. El mismo
 * input produce SIEMPRE el mismo cielo (criterio de aceptación nº1 de la pieza).
 *
 * Modelo geométrico:
 *  - Cada anime es una CONSTELACIÓN, colocada en una franja horizontal (celda)
 *    cuyo centro tiene un desplazamiento vertical determinista por el anime.
 *  - Dentro de una constelación cada estrella tiene un RADIO (rango canónico en
 *    su anime → núcleo = la mejor) y un ÁNGULO fijo (radio áureo + rotación de
 *    la constelación). El tamaño es función del ELO.
 *  - El escrutador NO re-maqueta: cada estrella DERIVA por su radio fijo según
 *    su rango DENTRO de su anime ese día (movimiento puramente radial).
 */

// Ángulo áureo (137.5°) en radianes: reparte los radios sin patrón visible.
const ANGULO_AUREO = 2.399963229728653

/** Geometría del lienzo virtual (px). Congelada: nadie la muta en runtime. */
export const LIENZO = Object.freeze({
  anchoConstelacion: 360,
  alto: 620,
  margenX: 80,
  estrellaMin: 14,
  estrellaMax: 46,
})

// --- hash estable -----------------------------------------------------------

/**
 * FNV-1a de 32 bits: hash determinista y barato. Lo usamos para derivar
 * ángulos/jitter reproducibles a partir de un slug, en lugar de `Math.random`.
 * @param {string} texto
 * @returns {number} entero sin signo de 32 bits
 */
export function hashTexto(texto) {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Real determinista en [0,1) a partir de un slug y una «sal» (para obtener
 * varios valores independientes del mismo slug).
 * @param {string} slug
 * @param {number} [sal=0]
 * @returns {number}
 */
export function azarSlug(slug, sal = 0) {
  return (hashTexto(`${slug}#${sal}`) % 100000) / 100000
}

// --- escalas ----------------------------------------------------------------

/**
 * Diámetro (px) de una estrella según su ELO normalizado al rango del ranking.
 * Se aplica una raíz para que los ELO bajos no queden visualmente aplastados.
 * @param {number} elo
 * @param {number} eloMin
 * @param {number} eloMax
 * @returns {number}
 */
export function tamanoEstrella(elo, eloMin, eloMax) {
  if (!(eloMax > eloMin)) return (LIENZO.estrellaMin + LIENZO.estrellaMax) / 2
  const t = Math.max(0, Math.min(1, (elo - eloMin) / (eloMax - eloMin)))
  const suave = Math.sqrt(t)
  return LIENZO.estrellaMin + suave * (LIENZO.estrellaMax - LIENZO.estrellaMin)
}

/** Radio (px) de una estrella desde el núcleo de su constelación por rango. */
function radioPorRango(rango) {
  return rango <= 0 ? 0 : 30 + Math.sqrt(rango) * 36
}

// --- agrupación --------------------------------------------------------------

/**
 * @typedef {{slug:string, nombre:string, anime:string, elo:number, posicion:number}} EntradaRanking
 */

/**
 * Agrupa el ranking en constelaciones (una por anime), en orden ESTABLE: por la
 * mejor posición del anime y, a igualdad, alfabético por nombre del anime. Los
 * miembros de cada grupo quedan ordenados por posición (núcleo primero).
 * @param {EntradaRanking[]} ranking
 * @returns {{anime:string, miembros:EntradaRanking[], mejorPosicion:number}[]}
 */
export function agruparConstelaciones(ranking) {
  const porAnime = new Map()
  for (const e of ranking) {
    const clave = e.anime || '—'
    if (!porAnime.has(clave)) porAnime.set(clave, [])
    porAnime.get(clave).push(e)
  }
  const grupos = []
  for (const [anime, miembros] of porAnime) {
    const ordenados = [...miembros].sort((a, b) => a.posicion - b.posicion)
    grupos.push({ anime, miembros: ordenados, mejorPosicion: ordenados[0].posicion })
  }
  grupos.sort(
    (a, b) =>
      a.mejorPosicion - b.mejorPosicion ||
      (a.anime < b.anime ? -1 : a.anime > b.anime ? 1 : 0),
  )
  return grupos
}

// --- proyección canónica -----------------------------------------------------

/**
 * @typedef {Object} Estrella
 * @property {string} slug
 * @property {string} nombre
 * @property {string} anime
 * @property {number} elo
 * @property {number} posicion        posición global canónica (1 = top)
 * @property {number} x
 * @property {number} y
 * @property {number} tam             diámetro px
 * @property {number} brillo          0.55..1 por ELO normalizado
 * @property {number} angulo          radianes, FIJO (el radio del astro)
 * @property {number} cx              centro X de su constelación
 * @property {number} cy              centro Y de su constelación
 * @property {string} constelacion    nombre del anime
 * @property {number} indiceConstelacion
 * @property {number} rangoEnAnime    rango canónico dentro de su anime (0 = núcleo)
 */

/**
 * Proyecta el ranking a un cielo DETERMINISTA.
 * @param {EntradaRanking[]} ranking
 * @returns {{estrellas:Estrella[], constelaciones:Object[], ancho:number, alto:number}}
 */
export function proyectarCielo(ranking) {
  if (!Array.isArray(ranking) || ranking.length === 0) {
    return { estrellas: [], constelaciones: [], ancho: 0, alto: LIENZO.alto }
  }
  const elos = ranking.map((e) => e.elo)
  const eloMin = Math.min(...elos)
  const eloMax = Math.max(...elos)
  const grupos = agruparConstelaciones(ranking)
  const estrellas = []
  const constelaciones = []

  grupos.forEach((grupo, gi) => {
    const cx =
      LIENZO.margenX + gi * LIENZO.anchoConstelacion + LIENZO.anchoConstelacion / 2
    const cy = LIENZO.alto / 2 + (azarSlug(grupo.anime, 7) - 0.5) * (LIENZO.alto * 0.28)
    const rotacion = azarSlug(grupo.anime, 11) * Math.PI * 2

    const miembros = grupo.miembros.map((e, idx) => {
      const angulo = ANGULO_AUREO * idx + rotacion
      const radio = radioPorRango(idx)
      const tam = tamanoEstrella(e.elo, eloMin, eloMax)
      const brillo =
        eloMax > eloMin ? 0.55 + 0.45 * ((e.elo - eloMin) / (eloMax - eloMin)) : 1
      const estrella = {
        slug: e.slug,
        nombre: e.nombre,
        anime: e.anime,
        elo: e.elo,
        posicion: e.posicion,
        x: cx + Math.cos(angulo) * radio,
        y: cy + Math.sin(angulo) * radio * 0.82,
        tam,
        brillo,
        angulo,
        cx,
        cy,
        constelacion: grupo.anime,
        indiceConstelacion: gi,
        rangoEnAnime: idx,
      }
      estrellas.push(estrella)
      return estrella
    })

    constelaciones.push({
      anime: grupo.anime,
      indice: gi,
      cx,
      cy,
      slugs: miembros.map((m) => m.slug),
      segmentos: enlazarConstelacion(miembros),
      mejorPosicion: grupo.mejorPosicion,
      tam: miembros.length,
    })
  })

  // Orden de foco por teclado = orden de ranking (criterio a11y nº3).
  estrellas.sort((a, b) => a.posicion - b.posicion)

  const ancho = LIENZO.margenX * 2 + grupos.length * LIENZO.anchoConstelacion
  return { estrellas, constelaciones, ancho, alto: LIENZO.alto }
}

/**
 * Cadena de segmentos que traza una constelación (núcleo → afuera), pensada
 * para un único `<path>`/`<line>` SVG por anime.
 * @param {Estrella[]} miembros  ya proyectados (con x/y) y ordenados por rango
 * @returns {{x1:number,y1:number,x2:number,y2:number,desde:string,hasta:string}[]}
 */
export function enlazarConstelacion(miembros) {
  const seg = []
  for (let i = 1; i < miembros.length; i += 1) {
    const a = miembros[i - 1]
    const b = miembros[i]
    seg.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, desde: a.slug, hasta: b.slug })
  }
  return seg
}

/**
 * Atributo `d` de un trazo de constelación a partir de su cadena de segmentos
 * (consecutivos: el x2/y2 de uno es el x1/y1 del siguiente). Null si no hay
 * segmentos (constelación de una sola estrella → nada que unir).
 * @param {{x1:number,y1:number,x2:number,y2:number}[]} segmentos
 * @returns {string|null}
 */
export function pathDeConstelacion(segmentos) {
  if (!Array.isArray(segmentos) || segmentos.length === 0) return null
  const inicio = segmentos[0]
  let d = `M ${inicio.x1} ${inicio.y1}`
  for (const s of segmentos) d += ` L ${s.x2} ${s.y2}`
  return d
}

// --- escrutador de mareas (temporal) ----------------------------------------

/**
 * @typedef {{slug:string, posicionesPorDia:number[]}} MovimientoSlug
 */

/**
 * ¿Hay serie temporal utilizable? (al menos un slug con ≥2 días). Si no, el
 * escrutador se deshabilita con nota honesta (estado del spec).
 * @param {MovimientoSlug[]} movimientos
 * @returns {boolean}
 */
export function haySerieTemporal(movimientos) {
  return (
    Array.isArray(movimientos) &&
    movimientos.some(
      (m) => Array.isArray(m.posicionesPorDia) && m.posicionesPorDia.length >= 2,
    )
  )
}

/** Número de días de la serie (el máximo entre todos los slugs). */
export function numeroDias(movimientos) {
  if (!Array.isArray(movimientos)) return 0
  return movimientos.reduce(
    (max, m) => Math.max(max, Array.isArray(m.posicionesPorDia) ? m.posicionesPorDia.length : 0),
    0,
  )
}

function clampDia(serie, dia) {
  return serie[Math.max(0, Math.min(serie.length - 1, dia))]
}

/**
 * Re-proyecta SOLO las posiciones para un día del escrutador. Centros y ángulos
 * NO se re-maquetan: cada estrella deriva radialmente según su rango dentro de
 * su anime ese día. Mismo input ⇒ misma salida.
 * @param {ReturnType<typeof proyectarCielo>} cielo  proyección canónica
 * @param {MovimientoSlug[]} movimientos
 * @param {number} dia  índice 0..(numeroDias-1)
 * @returns {Map<string,{x:number,y:number}>} slug → coordenada de ese día
 */
export function posicionesDelDia(cielo, movimientos, dia) {
  const posDia = new Map()
  for (const m of movimientos || []) {
    const serie = m.posicionesPorDia
    if (Array.isArray(serie) && serie.length > 0) posDia.set(m.slug, clampDia(serie, dia))
  }
  const porAnime = new Map()
  for (const e of cielo.estrellas) {
    if (!porAnime.has(e.constelacion)) porAnime.set(e.constelacion, [])
    porAnime.get(e.constelacion).push(e)
  }
  const salida = new Map()
  for (const [, miembros] of porAnime) {
    const ordenados = [...miembros].sort(
      (a, b) => (posDia.get(a.slug) ?? a.posicion) - (posDia.get(b.slug) ?? b.posicion),
    )
    ordenados.forEach((e, rangoDia) => {
      const radio = radioPorRango(rangoDia)
      salida.set(e.slug, {
        x: e.cx + Math.cos(e.angulo) * radio,
        y: e.cy + Math.sin(e.angulo) * radio * 0.82,
      })
    })
  }
  return salida
}

/**
 * Movers entre dos días (para las estelas del escrutador y los titileos del día
 * actual): delta = posición(diaA) − posición(diaB). delta>0 ⇒ SUBIÓ hacia diaB.
 * Orden descendente por magnitud del movimiento.
 * @param {MovimientoSlug[]} movimientos
 * @param {number} diaA
 * @param {number} diaB
 * @returns {{slug:string, desde:number, hasta:number, delta:number}[]}
 */
export function moversEntre(movimientos, diaA, diaB) {
  const out = []
  for (const m of movimientos || []) {
    const s = m.posicionesPorDia
    if (!Array.isArray(s) || s.length === 0) continue
    const a = clampDia(s, diaA)
    const b = clampDia(s, diaB)
    if (a === b) continue
    out.push({ slug: m.slug, desde: a, hasta: b, delta: a - b })
  }
  out.sort((p, q) => Math.abs(q.delta) - Math.abs(p.delta))
  return out
}
