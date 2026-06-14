/**
 * codex-core — módulo hermano de FighterCodex.
 *
 * Lógica pura y sin React: guión de apertura (timings exactos por acto),
 * mapeo de hitos del historial de ELO al "río de tinta", utilidad de cadencia
 * de sellos y el gate de "apertura una vez por sesión" (skipEntrance).
 *
 * Reglas de la casa respetadas aquí:
 *  - funciones puras → seguras para inicializadores de estado en StrictMode
 *    (que monta doble); ninguna lee `Date.now()` / `Math.random()` salvo las
 *    marcadas como side-effect (sessionStorage), que SOLO se llaman desde
 *    handlers/effects, nunca en el cuerpo del render.
 *  - variación "aleatoria" = determinista por índice.
 *
 * @module codex-core
 */

/**
 * Guión de apertura. Todos los valores en milisegundos, a velocidad 1×.
 * El componente multiplica por el factor de cámara lenta del panel de
 * director (5× en la demo); en producción el factor es siempre 1.
 *
 * Secuencia:
 *   morphSettle  el morph compartido personaje-hero asienta ANTES de girar.
 *   cover        giro 3D de la cubierta (rotateY, ease-lift).
 *   name         trazado del nombre (clip-path wipe, ease-brush) tras abrir.
 *   sealStart    primer sello (offset desde que arranca el frontispicio).
 *   sealGap      cadencia entre sellos consecutivos.
 *   sealDur      duración del estampado de cada sello (ease-stamp).
 *   bookmarks    entrada de los marcapáginas tras los sellos.
 *   bookmarkGap  stagger entre marcapáginas.
 *
 * @type {{morphSettle:number, cover:number, name:number, sealStart:number,
 *   sealGap:number, sealDur:number, bookmarks:number, bookmarkGap:number,
 *   pleatClose:number, pleatOpen:number, river:number, riverHitoGap:number}}
 */
export const GUION = Object.freeze({
  morphSettle: 120,
  cover: 650,
  name: 500,
  sealStart: 360,
  sealGap: 240,
  sealDur: 460,
  bookmarks: 1100,
  bookmarkGap: 60,
  pleatClose: 300,
  pleatOpen: 350,
  river: 700,
  riverHitoGap: 90,
});

/** Orden canónico de los pliegos (índice = posición física en el libro). */
export const PLIEGOS = Object.freeze(['stats', 'rio', 'matchups', 'votos']);

/**
 * Devuelve el desfase de cada sello dentro de la cadencia de apertura.
 * El primer sello (índice 0) es el único que dispara `playVerdictStamp`;
 * el resto usa `playSello`.
 *
 * @param {number} total  Número de sellos (la ficha siempre pasa 3).
 * @param {object} [guion=GUION]  Guión de timings.
 * @returns {Array<{index:number, delay:number, verdict:boolean}>}
 */
export function cadenciaSellos(total, guion = GUION) {
  const out = [];
  for (let i = 0; i < total; i += 1) {
    out.push({ index: i, delay: guion.sealStart + i * guion.sealGap, verdict: i === 0 });
  }
  return out;
}

/**
 * Dirección del cierre/apertura de pliego según los índices de origen y
 * destino: si avanzamos en el libro el pliego actual se cierra hacia la
 * izquierda (scaleX origin-left) y el nuevo se abre desde la derecha; al
 * retroceder, al revés. Devuelve también el `transform-origin` de cada fase.
 *
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {{forward:boolean, closeOrigin:string, openOrigin:string}}
 */
export function direccionPliego(fromKey, toKey) {
  const forward = PLIEGOS.indexOf(toKey) > PLIEGOS.indexOf(fromKey);
  return {
    forward,
    closeOrigin: forward ? 'left center' : 'right center',
    openOrigin: forward ? 'right center' : 'left center',
  };
}

/**
 * Geometría del río de tinta. Normaliza la serie de votos a un viewBox fijo
 * y devuelve los `d` de la línea y del área (sangrado), el punto final y los
 * hitos ya posicionados sobre la orilla. `pathLength` se fija a 1 en el SVG
 * para evitar `getTotalLength` (regla de la casa).
 *
 * Honestidad: con menos de 2 puntos NO hay río → `seco: true` y el consumidor
 * pinta el estado 空; jamás se inventa una línea.
 *
 * @param {Array<{fecha:string, votos:number}>} historial  Serie /elo-history.
 * @param {Array<{i:number, kanji:string, label:string}>} [hitosDef]  Hitos a
 *   anclar (índices dentro de `historial`). Ver `mapearHitos`.
 * @param {{W:number, H:number, PAD:number}} [box]
 * @returns {object}
 */
export function geometriaRio(historial, hitosDef = [], box = { W: 600, H: 200, PAD: 18 }) {
  const { W, H, PAD } = box;
  if (!Array.isArray(historial) || historial.length < 2) {
    return { seco: true };
  }
  const vals = historial.map((p) => p.votos);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const n = historial.length;
  const xy = historial.map((p, i) => ({
    x: PAD + (i / (n - 1)) * (W - PAD * 2),
    y: H - PAD - ((p.votos - min) / span) * (H - PAD * 2),
    votos: p.votos,
    fecha: p.fecha,
    i,
  }));
  const linea = xy
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const area = `${linea} L ${xy[n - 1].x.toFixed(1)} ${H - PAD} L ${xy[0].x.toFixed(1)} ${H - PAD} Z`;
  const peakIdx = vals.indexOf(max);
  const hitos = hitosDef
    .filter((h) => h.i >= 0 && h.i < n)
    .map((h) => ({
      ...h,
      x: xy[h.i].x,
      y: xy[h.i].y,
      leftPct: `${((xy[h.i].x / W) * 100).toFixed(2)}%`,
      topPct: `${((xy[h.i].y / H) * 100 - 9).toFixed(2)}%`,
    }));
  return {
    seco: false,
    W, H, PAD,
    linea,
    area,
    pts: xy,
    last: xy[n - 1],
    peak: xy[peakIdx],
    inicial: vals[0],
    actual: vals[n - 1],
    delta: vals[n - 1] - vals[0],
    hitos,
  };
}

/**
 * Mapea eventos del backend (entradas a top-10, rachas, pico) a hitos del río.
 * Acepta la forma cruda del historial enriquecido si existe; si NO hay
 * eventos, devuelve []  → el río se dibuja sin sellos (sigue siendo honesto).
 *
 * @param {Array<{fecha:string, votos:number, evento?:string}>} historial
 * @returns {Array<{i:number, kanji:string, label:string}>}
 */
export function mapearHitos(historial) {
  if (!Array.isArray(historial)) return [];
  const KANJI = { 'top-10': '位', racha: '炎', pico: '頂' };
  const out = [];
  historial.forEach((p, i) => {
    if (!p || !p.evento) return;
    const kanji = KANJI[p.evento];
    if (!kanji) return;
    out.push({ i, kanji, label: etiquetaHito(p.evento, p) });
  });
  return out;
}

function etiquetaHito(evento, p) {
  switch (evento) {
    case 'top-10':
      return 'Entró al top-10';
    case 'racha':
      return p.rachaLen ? `Racha de ${p.rachaLen} victorias` : 'Racha de victorias';
    case 'pico':
      return p.votos != null ? `Pico histórico · ${p.votos}` : 'Pico histórico';
    default:
      return evento;
  }
}

const SESSION_KEY = 'animeshowdown.codex.seen';

/**
 * ¿Debe saltarse la apertura? `true` si esta ficha (slug) ya se abrió en la
 * sesión actual. Side-effect (sessionStorage) → llamar SOLO desde effect o
 * handler, nunca en el cuerpo del render. Devuelve `false` y marca como vista
 * cuando es la primera vez.
 *
 * @param {string} slug
 * @returns {boolean} skipEntrance
 */
export function consumirSkipEntrance(slug) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const seen = raw ? JSON.parse(raw) : {};
    if (seen[slug]) return true;
    seen[slug] = 1;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(seen));
    return false;
  } catch {
    return false;
  }
}

/** ¿El usuario pidió menos movimiento? Seguro en SSR/jsdom. */
export function prefiereCalma() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
