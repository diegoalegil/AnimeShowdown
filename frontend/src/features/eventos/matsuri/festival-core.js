/**
 * festival-core.js — logica pura de la pieza "Matsuri nocturno" (takeover de
 * /eventos/:slug). Modulo HERMANO (no-componente) de FestivalProcession y
 * satelites: aqui vive todo lo que NO es React.
 *
 * Cero `Date.now()`/`Math.random()`/`new Date()` en el cuerpo del modulo: las
 * funciones que necesitan tiempo lo reciben como argumento (`now`/`nowMs`) desde
 * un effect o handler del componente. Toda variacion "aleatoria" es DETERMINISTA
 * por indice (StrictMode monta doble sin divergir).
 *
 * IMPORTANTE — adaptacion al dominio REAL:
 *  - El evento real tiene `inicioISO`/`finISO` (NO `fechaInicio`/`fechaFin`),
 *    `titulo` (NO `nombre`) y `descripcionCorta` (NO `descripcion`).
 *  - El evento real NO tiene `bloques` ni `hitos`. Los hitos se DERIVAN de la
 *    linea temporal real (deriveHitosEvento): Apertura / Ecuador / Recta final /
 *    Cierre. Cero fabricacion, cero backend.
 *
 * @module festival-core
 */

/* --------------------------------------------------------------- PUESTOS */

/**
 * Kanji canonico por tipo de puesto (reutilizados del subset de marca; ver
 * notas de handoff para la lista anti-tofu). Significado, no relleno. La pieza
 * NO mapea bloques (el dominio real no tiene): el padre elige el tipo del puesto
 * por seccion real (mision -> aviso, ranking -> recompensa).
 * @type {Record<string,string>}
 */
export const KANJI_TIPO = {
  regla: '決',       // decision / regla
  actividad: '遊',   // juego / actividad
  recompensa: '王',  // corona / recompensa
  texto: '御',       // aviso honorifico / nota
}

/** Etiqueta mono por tipo (cartelito de la tablilla). */
export const ETIQUETA_TIPO = {
  regla: 'regla',
  actividad: 'actividad',
  recompensa: 'recompensa',
  texto: 'aviso',
}

/* --------------------------------------------------------- HITOS POR FASE */

const MS_SEG = 1000
const MS_MIN = 60 * MS_SEG
const MS_HORA = 60 * MS_MIN
const MS_DIA = 24 * MS_HORA

/**
 * Fracciones del recorrido donde cae cada fase. Apertura = inicio (0%),
 * Ecuador = punto medio (50%), Recta final = 75% del recorrido, Cierre = fin.
 * @type {Array<{id:string, nombre:string, frac:number}>}
 */
export const FASES_EVENTO = [
  { id: 'apertura', nombre: 'Apertura', frac: 0 },
  { id: 'ecuador', nombre: 'Ecuador', frac: 0.5 },
  { id: 'recta-final', nombre: 'Recta final', frac: 0.75 },
  { id: 'cierre', nombre: 'Cierre', frac: 1 },
]

/**
 * Fecha corta humana (es-ES) para la etiqueta de un hito, p.ej. "25 may".
 * @param {number} ms epoch ms
 * @returns {string}
 */
export function fechaCortaHito(ms) {
  return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/**
 * Deriva los hitos de fecha-fase del evento a partir de su linea temporal real
 * (`inicioISO`/`finISO`). NO inventa nada: cada hito es un instante real del
 * recorrido. `alcanzado = nowMs >= fechaMs`.
 *
 * @param {{inicioISO:string|number|Date, finISO:string|number|Date}} evento
 * @param {Date|number} [now=Date.now()] instante de referencia (inyectado desde
 *   el componente: el cuerpo de este modulo no lee el reloj)
 * @returns {Array<{id:string, etiqueta:string, fechaISO:string, fechaMs:number, alcanzado:boolean}>}
 */
export function deriveHitosEvento(evento, now = Date.now()) {
  if (!evento?.inicioISO || !evento?.finISO) return []
  const inicio = +new Date(evento.inicioISO)
  const fin = +new Date(evento.finISO)
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) return []
  const nowMs = typeof now === 'number' ? now : +now
  const span = fin - inicio
  return FASES_EVENTO.map((fase) => {
    const fechaMs = Math.round(inicio + span * fase.frac)
    return {
      id: fase.id,
      etiqueta: `${fase.nombre} · ${fechaCortaHito(fechaMs)}`,
      fechaISO: new Date(fechaMs).toISOString(),
      fechaMs,
      alcanzado: nowMs >= fechaMs,
    }
  })
}

/* ------------------------------------------------------------------ HANABI */

/** Particulas por crisantemo. */
export const HANABI_PARTICULAS = 12

/**
 * Posicion (en % del cielo) y desfase de cada uno de los 3 crisantemos.
 * Determinista: la celebracion completa dura ~1.4s (ultimo delay + vuelo).
 * @type {Array<{x:number, y:number, delayMs:number, radio:number, tono:('oro'|'carmin')}>}
 */
export const HANABI_CRISANTEMOS_LAYOUT = [
  { x: 30, y: 22, delayMs: 0,   radio: 86, tono: 'oro' },
  { x: 68, y: 16, delayMs: 220, radio: 96, tono: 'carmin' },
  { x: 50, y: 30, delayMs: 440, radio: 78, tono: 'oro' },
]

/**
 * Frames pre-posicionados de las particulas de un crisantemo: cada particula
 * sale del centro a (dx,dy) en px. Determinista por indice (angulo repartido
 * en el circulo + leve desfase del crisantemo para que no calquen).
 *
 * Pool reutilizado: el componente calcula esto UNA vez (no por disparo) y reusa
 * los 3 contenedores; solo re-keya la animacion al celebrar.
 *
 * @param {number} [crisantemoIndex=0] desfase angular por crisantemo
 * @param {number} [radio=88] radio del crisantemo en px
 * @param {number} [particulas=HANABI_PARTICULAS]
 * @returns {Array<{dx:string, dy:string}>} valores listos para custom props CSS
 */
export function framesCrisantemo(crisantemoIndex = 0, radio = 88, particulas = HANABI_PARTICULAS) {
  const offset = (crisantemoIndex * Math.PI) / particulas
  const out = []
  for (let i = 0; i < particulas; i++) {
    const ang = (i / particulas) * Math.PI * 2 + offset
    // Radio con dos anillos deterministas (pares mas lejos) -> crisantemo, no aro.
    const r = i % 2 === 0 ? radio : radio * 0.74
    out.push({
      dx: `${(Math.cos(ang) * r).toFixed(2)}px`,
      dy: `${(Math.sin(ang) * r).toFixed(2)}px`,
    })
  }
  return out
}

/* --------------------------------------------------------------- COUNTDOWN */

/**
 * Descompone una distancia en ms a dias/horas/min/seg (sin negativos).
 * @param {number} ms
 * @returns {{dias:number, horas:number, mins:number, segs:number, total:number}}
 */
export function descomponerMs(ms) {
  const total = Math.max(0, Math.floor(ms))
  return {
    dias: Math.floor(total / MS_DIA),
    horas: Math.floor((total % MS_DIA) / MS_HORA),
    mins: Math.floor((total % MS_HORA) / MS_MIN),
    segs: Math.floor((total % MS_MIN) / MS_SEG),
    total,
  }
}

/** Unidades de tiempo en singular/plural (es). */
const UNIDADES = {
  dias: ['dia', 'dias'],
  horas: ['hora', 'horas'],
  mins: ['minuto', 'minutos'],
  segs: ['segundo', 'segundos'],
}

/**
 * Frase COMPLETA para lectores de pantalla y `<time>` ("Termina en 2 dias y
 * 4 horas"). NO incluye segundos salvo que sea lo unico que queda — los AT no
 * deben recibir un tic cada segundo (el componente refresca esto cada minuto).
 *
 * `estado` usa los valores REALES del dominio: 'ACTIVO' | 'PROXIMO' | 'PASADO'.
 *
 * @param {number} ms distancia
 * @param {'ACTIVO'|'PROXIMO'|'PASADO'} estado
 * @returns {string}
 */
export function fraseCountdown(ms, estado) {
  if (estado === 'PASADO') return 'El evento ha finalizado.'
  const { dias, horas, mins, segs } = descomponerMs(ms)
  const partes = []
  if (dias) partes.push(`${dias} ${plural('dias', dias)}`)
  if (horas) partes.push(`${horas} ${plural('horas', horas)}`)
  if (!dias && mins) partes.push(`${mins} ${plural('mins', mins)}`)
  if (!dias && !horas && !mins) partes.push(`${segs} ${plural('segs', segs)}`)
  const cuerpo = unirNatural(partes)
  return estado === 'PROXIMO' ? `Empieza en ${cuerpo}.` : `Termina en ${cuerpo}.`
}

function plural(unidad, n) {
  const par = UNIDADES[unidad]
  return n === 1 ? par[0] : par[1]
}

/** Une ["2 dias","4 horas"] -> "2 dias y 4 horas". */
function unirNatural(partes) {
  if (partes.length === 0) return 'unos instantes'
  if (partes.length === 1) return partes[0]
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/** Dos cifras con cero a la izquierda para el odometro. */
export function pad2(n) {
  return String(Math.max(0, n)).padStart(2, '0')
}

/* ---------------------------------------------------------- NUMERALES KANJI */

/** Numerales 一..十 para las piedras de la senda (subset de marca). */
export const NUMERALES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
