// ============================================================================
// sanctuary-core.js — modulo HERMANO de WrappedSanctuary (no-componentes:
// guion por sala, formateadores, pool de papeletas determinista y un hook de
// odometro). Vive aparte para no romper react-refresh (los .jsx solo exportan
// componentes). React 19 + React Compiler: nada de Date.now()/Math.random()
// en render — la variacion "aleatoria" de la lluvia es DETERMINISTA por indice.
// ============================================================================

import { useEffect, useRef } from 'react'

const NF_ES = new Intl.NumberFormat('es-ES')

/** Formatea un numero al locale es-ES (1284 -> "1.284"). */
export function nfEs(n) {
  return NF_ES.format(Number(n ?? 0))
}

const KANJI_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/** Acuna un anio en kanji decorativo (2026 -> "二零二六"). Solo cosmetica:
 *  el texto real del anio va aparte y accesible. */
export function anioKanji(anio) {
  return String(anio ?? '')
    .split('')
    .map((c) => KANJI_DIGITS[Number(c)] ?? c)
    .join('')
}

// Guion canonico por sala. Kanji con SIGNIFICADO (anti-relleno) — todos
// reutilizados del subset de marca existente salvo donde se indica:
//   入 entrar · 票 papeleta/voto · 祭 rito/altar · 灯 farol · 界 mundo/universo
//   結 nudo/conclusion (ya en uso por WrappedCinematic) · 印 sello/cuno · 推 oshi
export const GUION = Object.freeze({
  entrada: { kanji: '入', titulo: 'La Entrada', selloKanji: '印' },
  votos: { kanji: '票', titulo: 'La Lluvia de Votos' },
  altar: { kanji: '祭', titulo: 'El Altar de los Fieles' },
  racha: { kanji: '灯', titulo: 'La Senda de la Racha' },
  espejo: { kanji: '界', titulo: 'El Espejo del Gusto' },
  emaki: { kanji: '結', titulo: 'El Emaki' },
})

// Timings exactos (ms) — referenciados por los componentes y por las notas.
export const TIMING = Object.freeze({
  inkCut: 420, // corte de tinta del titular
  rise: 560, // entrada de copy
  stampDelay: 320, // retardo del sello del anio
  ballotPass: 1800, // una pasada de la lluvia
  pedestalStep: 100, // stagger entre pedestales
  pedestalRise: 350,
  lanternStep: 80, // stagger entre faroles
  odometer: 1700, // count-up del odometro de votos
  emakiUnroll: 800, // desenrollado del rollo
  wakeRatio: 0.4, // % de visibilidad que despierta una sala
})

export const MAX_LANTERNS = 14

/**
 * Pool DETERMINISTA de 14 papeletas. Mismas posiciones/retardos en cada
 * render y en SSR/StrictMode (cero Math.random). El componente reutiliza
 * estos 14 nodos: una sola pasada al entrar a viewport, cero creacion por
 * frame.
 * @returns {Array<{left:string, delay:string, dur:string, rot:string}>}
 */
export function ballotPool() {
  return Array.from({ length: MAX_LANTERNS }, (_, i) => ({
    left: (((i * 6.35 + 4) % 92) + 4).toFixed(1) + '%',
    delay: ((i * 0.11) % 1.05).toFixed(2) + 's',
    dur: (1.5 + ((i * 7) % 6) / 10).toFixed(2) + 's',
    rot: (i % 2 ? 1 : -1) * (8 + ((i * 5) % 24)) + 'deg',
  }))
}

/**
 * Decide que salas se muestran segun los datos. Sin dato -> sala FUERA (sin
 * hueco). entrada y emaki son siempre. Devuelve la lista en orden de recorrido.
 * @param {object} w wrapped (shape de /api/wrapped/me)
 * @returns {Array<{id:string, kanji:string, titulo:string}>}
 */
export function visibleRooms(w) {
  const r = [withGuion('entrada')]
  if ((w?.votosTotales ?? 0) > 0) r.push(withGuion('votos'))
  if (Array.isArray(w?.top3) && w.top3.length) r.push(withGuion('altar'))
  if ((w?.mejorRacha ?? 0) >= 1) r.push(withGuion('racha'))
  if (w?.universoTop && w.universoTop.anime) r.push(withGuion('espejo'))
  r.push(withGuion('emaki'))
  return r
}

function withGuion(id) {
  return { id, kanji: GUION[id].kanji, titulo: GUION[id].titulo }
}

/** Top3 reordenado a podio (centro = nº1, mas alto). */
export function podio(top3 = []) {
  const order = top3.length === 3 ? [1, 0, 2] : top3.map((_, i) => i)
  return order.map((srcIdx) => ({ ...top3[srcIdx], rank: srcIdx }))
}

/** Iniciales para el retrato placeholder ("Gojo Satoru" -> "GS"). */
export function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * Odometro font-mono: cuenta de 0 a `to` cuando `run` pasa a true, escribiendo
 * directo al DOM via ref (cero re-render por frame, regla del React Compiler:
 * lo que cambia >1x/frame NO va en estado). Respeta reduced-motion: pone el
 * valor final al instante. WAAPI no se usa aqui; rAF basta y degrada limpio.
 * @param {object} ref ref al nodo de texto
 * @param {number} to valor final
 * @param {boolean} run dispara la cuenta
 * @param {{durationMs?:number, suffix?:string, reduced?:boolean, format?:Function}} [opts]
 */
export function useCountUp(ref, to, run, opts = {}) {
  const { durationMs = TIMING.odometer, suffix = '', reduced = false, format = nfEs } = opts
  const rafRef = useRef(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    if (!run) {
      node.textContent = format(0) + suffix
      return undefined
    }
    if (reduced) {
      node.textContent = format(to) + suffix
      return undefined
    }
    const start = performance.now()
    const ease = (t) => 1 - Math.pow(1 - t, 3)
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs)
      node.textContent = format(Math.round(to * ease(t))) + suffix
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    node.textContent = format(0) + suffix
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [ref, to, run, durationMs, suffix, reduced, format])
}
