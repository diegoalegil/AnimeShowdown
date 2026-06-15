/**
 * theater-utils.js — AnimeShowdown · El Teatro del Torneo (PRODUCCIÓN)
 * Módulo hermano de TournamentTheater. Funciones PURAS (sin React, sin DOM,
 * sin Date/Math.random) que compilan el "guión" de la función desde el
 * bracket, derivan el estado visual de cualquier paso y resuelven la
 * geometría del cuadro.
 *
 * Criterio nº2 (innegociable): el estado visual de la función se DERIVA del
 * índice de paso, nunca se acumula → deriveBracketState() es idempotente.
 * El scrubber adelante/atrás jamás desincroniza.
 *
 * @typedef {{ slug: string, nombre: string, anime?: string }} Persona
 * @typedef {{
 *   id: string|number, personaje1: Persona, personaje2: Persona,
 *   votos1: number, votos2: number,
 *   estado: 'OPEN'|'RESOLVED', ganadorSlug: string|null
 * }} Match
 * @typedef {{
 *   slug: string, nombre: string,
 *   estado: 'IN_PROGRESS'|'FINISHED'|'SCHEDULED',
 *   rondaActual: number, totalRondas: number,
 *   numParticipantes: number, ganadorSlug: string|null,
 *   fechaInicio?: string
 * }} Torneo
 */

const KANJI_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

/** @param {number} n 1-based → '一'..'十' (fallback al número árabe). */
export function kanjiNumeral(n) { return KANJI_NUM[n] ?? String(n) }

/** Nombre humano de una ronda a partir de cuántos enfrentamientos tiene. */
export function nombreRonda(matchesEnRonda) {
  switch (matchesEnRonda) {
    case 1: return 'Final'
    case 2: return 'Semifinal'
    case 4: return 'Cuartos de final'
    case 8: return 'Octavos de final'
    case 16: return 'Dieciseisavos'
    default: return `Ronda de ${matchesEnRonda * 2}`
  }
}

/**
 * normalizeRounds — ADAPTADOR REAL→CANVAS. El detalle del torneo sirve un
 * array PLANO de enfrentamientos (NO Match[][]); cada uno con `ronda`
 * (1-based), `personaje1`/`personaje2`, `ganador` (truthy ⇒ resuelto) y
 * `personaje1Votos`/`personaje2Votos`. Esta función PURA agrupa por ronda
 * ascendente, ordena cada grupo por id ascendente y lo proyecta al shape
 * Match[][] que esperan compileScript / computeLayout / deriveBracketState.
 *
 * @param {Array<{id:string|number, ronda:number, personaje1:Persona, personaje2:Persona, ganador?:Persona|null, personaje1Votos?:number, personaje2Votos?:number}>} enfrentamientos
 * @returns {Match[][]}
 */
export function normalizeRounds(enfrentamientos) {
  if (!Array.isArray(enfrentamientos) || enfrentamientos.length === 0) return []
  const porRonda = new Map()
  for (const e of enfrentamientos) {
    const r = Number(e.ronda)
    if (!Number.isFinite(r)) continue
    if (!porRonda.has(r)) porRonda.set(r, [])
    porRonda.get(r).push(e)
  }
  const rondasOrdenadas = [...porRonda.keys()].sort((a, b) => a - b)
  return rondasOrdenadas.map((r) => {
    const grupo = porRonda.get(r).slice().sort((a, b) => {
      const ai = a.id, bi = b.id
      if (typeof ai === 'number' && typeof bi === 'number') return ai - bi
      return String(ai).localeCompare(String(bi), undefined, { numeric: true })
    })
    return grupo.map((e) => ({
      id: e.id,
      personaje1: e.personaje1,
      personaje2: e.personaje2,
      votos1: e.personaje1Votos ?? 0,
      votos2: e.personaje2Votos ?? 0,
      estado: e.ganador ? 'RESOLVED' : 'OPEN',
      ganadorSlug: e.ganador?.slug ?? null,
    }))
  })
}

/** Feeders del match (r,i): ganador de (r-1,2i) → slot 0; (r-1,2i+1) → slot 1. */
export function feedersDe(idx) { return { izq: idx * 2, der: idx * 2 + 1 } }

/**
 * Compila el guión: un paso por enfrentamiento RESUELTO, en orden de lectura.
 * @param {Match[][]} rounds
 * @returns {{ steps: Array<{matchId, ronda, idx, ganador: Persona, perdedor: Persona, narracion: string}>, totalSteps: number }}
 */
export function compileScript(rounds) {
  const steps = []
  rounds.forEach((ronda, r) => {
    ronda.forEach((m, i) => {
      if (m.estado !== 'RESOLVED' || !m.ganadorSlug) return
      const gana1 = m.ganadorSlug === m.personaje1?.slug
      const ganador = gana1 ? m.personaje1 : m.personaje2
      const perdedor = gana1 ? m.personaje2 : m.personaje1
      // Bye / walkover: un slot sin persona → no hubo duelo que narrar (y
      // `perdedor.nombre` sobre null reventaría). Se omite del guión.
      if (!ganador || !perdedor) return
      steps.push({ matchId: m.id, ronda: r, idx: i, ganador, perdedor, narracion: `${ganador.nombre} elimina a ${perdedor.nombre}` })
    })
  })
  return { steps, totalSteps: steps.length }
}

/** aria-valuetext del scrubber para el paso `step` (0..totalSteps). */
export function valueTextPaso(step, guion) {
  if (step <= 0) return `Inicio: cuadro sin resolver, ${guion.totalSteps} duelos por jugar`
  const s = guion.steps[step - 1]
  if (!s) return `Función completa: ${guion.totalSteps} de ${guion.totalSteps} duelos`
  return `Paso ${step} de ${guion.totalSteps}: ${s.narracion}`
}

function posicionesGuion(guion) {
  const m = new Map()
  guion.steps.forEach((s, i) => m.set(s.matchId, i))
  return m
}

/**
 * DERIVA el estado visual completo del cuadro tras `completedSteps` pasos.
 * Idempotente y puro. Un slot está "seated" si su ronda es 0 o su match
 * alimentador ya está resuelto a esta altura del guión.
 * @returns {{ rondas: Array<Array<object>>, campeon: Persona|null }}
 */
export function deriveBracketState(torneo, rounds, completedSteps) {
  const guion = compileScript(rounds)
  const pos = posicionesGuion(guion)
  const ganadorEn = (r, i) => {
    const m = rounds[r]?.[i]
    if (!m || m.estado !== 'RESOLVED' || !m.ganadorSlug) return null
    const p = pos.get(m.id)
    if (p == null || p >= completedSteps) return null
    return m.ganadorSlug === m.personaje1?.slug ? m.personaje1 : m.personaje2
  }
  const rondas = rounds.map((ronda, r) =>
    ronda.map((m, i) => {
      const scriptPos = pos.has(m.id) ? pos.get(m.id) : -1
      const resolved = scriptPos !== -1 && scriptPos < completedSteps
      const resolving = scriptPos === completedSteps
      const status = resolved ? 'resolved' : resolving ? 'resolving' : 'pending'
      let p1 = m.personaje1, p2 = m.personaje2, seated1 = true, seated2 = true
      if (r > 0) {
        const { izq, der } = feedersDe(i)
        const g1 = ganadorEn(r - 1, izq)
        const g2 = ganadorEn(r - 1, der)
        p1 = g1 ?? m.personaje1; p2 = g2 ?? m.personaje2
        seated1 = Boolean(g1); seated2 = Boolean(g2)
      }
      const win = resolved ? m.ganadorSlug : null
      // Votos POR SLUG de la persona del slot, no por posición: en r>0 el slot
      // se re-deriva por feeders, así que el número debe seguir a esa persona
      // (no al orden personaje1/2 del match) o nombre y voto quedarían cruzados.
      // null si la persona no casa con ningún lado del match (MatchScroll lo
      // omite). En r===0, p1/p2 === personaje1/2 → votos1/votos2 sin cambio.
      const votoDe = (persona) =>
        persona?.slug && persona.slug === m.personaje1?.slug
          ? m.votos1
          : persona?.slug && persona.slug === m.personaje2?.slug
            ? m.votos2
            : null
      return {
        id: m.id, ronda: r, idx: i, status, scriptPos,
        votos1: votoDe(p1), votos2: votoDe(p2), ganadorSlug: m.ganadorSlug,
        slot1: { persona: p1, seated: seated1, isWinner: win === p1?.slug, isLoser: Boolean(win) && win !== p1?.slug && seated1 },
        slot2: { persona: p2, seated: seated2, isWinner: win === p2?.slug, isLoser: Boolean(win) && win !== p2?.slug && seated2 },
      }
    }),
  )
  let campeon = null
  const ultima = rounds[rounds.length - 1]
  if (ultima && ultima.length === 1) {
    const fin = ultima[0]
    const p = pos.get(fin.id)
    if (fin.estado === 'RESOLVED' && fin.ganadorSlug && p != null && p < completedSteps) {
      campeon = fin.ganadorSlug === fin.personaje1?.slug ? fin.personaje1 : fin.personaje2
    }
  }
  return { rondas, campeon }
}

/* ── Geometría del cuadro (pura, sin DOM) ─────────────────────────────────── */

/** Codo ortogonal con esquinas redondeadas (cuerda entre matches). */
export function elbowPath(x1, y1, x2, y2, r = 12) {
  const mx = (x1 + x2) / 2
  if (Math.abs(y1 - y2) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`
  const dir = y2 > y1 ? 1 : -1
  const rr = Math.min(r, Math.abs(y2 - y1) / 2, Math.abs(mx - x1), Math.abs(x2 - mx))
  return `M ${x1} ${y1} L ${mx - rr} ${y1} Q ${mx} ${y1} ${mx} ${y1 + dir * rr} L ${mx} ${y2 - dir * rr} Q ${mx} ${y2} ${mx + rr} ${y2} L ${x2} ${y2}`
}

/**
 * Layout absoluto del cuadro: centra cada match entre sus dos feeders. Pura
 * → la geometría de las cuerdas no necesita medir el DOM (cero ResizeObserver),
 * y un cuadro de 32 escala sin saltos de layout.
 * @returns {{cols:Array<{x:number,matches:Array<{y:number,cy:number}>}>, width:number, height:number, H:number, colW:number, colGap:number}}
 */
export function computeLayout(rounds, opt = {}) {
  const { H = 104, gap0 = 22, colW = 244, colGap = 76 } = opt
  const centers = []
  rounds.forEach((ronda, r) => {
    centers[r] = r === 0
      ? ronda.map((_, i) => i * (H + gap0) + H / 2)
      : ronda.map((_, i) => (centers[r - 1][2 * i] + centers[r - 1][2 * i + 1]) / 2)
  })
  const n0 = rounds[0].length
  const height = n0 * (H + gap0) - gap0
  const cols = rounds.map((ronda, r) => ({
    x: r * (colW + colGap),
    matches: ronda.map((_, i) => ({ y: centers[r][i] - H / 2, cy: centers[r][i] })),
  }))
  const width = (rounds.length - 1) * (colW + colGap) + colW
  return { cols, width, height, H, colW, colGap }
}
