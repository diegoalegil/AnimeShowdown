import { personajes } from '../lib/personajes-core'
import { getCategoriasPersonaje } from './personajes-tags'

/**
 * Eventos temporales.
 *
 * <p>V1 deliberadamente simple: la fuente de verdad de los eventos vive
 * aquí (JSON versionado en git). Cada cambio = un commit revisable.
 *
 * <p>Trade-off de no haber metido entidad backend en v1:
 *   - Pro: cero migration, cero admin UI, evolución por PR. El equipo
 *     puede crear/editar eventos abriendo este archivo. Tests visuales
 *     de fechas pasadas/futuras son triviales (cambia el ISO).
 *   - Contra: no hay edición en runtime — un evento añadido HOY no
 *     aparece hasta el siguiente deploy. Para v2 (cuando se necesite
 *     que un admin no-dev pueda crear), migrar el JSON a tabla
 *     `eventos` con el MISMO shape de aquí; la capa de helpers
 *     `getEventoActivo`, `getPersonajesEvento` etc se mantiene
 *     idéntica y los consumidores (Pulso, /eventos) ni se enteran.
 *
 * <p>Filtros soportados (extensibles — añadir un case en
 * `getPersonajesEvento` para sumar otro tipo):
 *   - `{ kind: 'anime', valor: 'One Piece' }` — personajes de ese anime
 *   - `{ kind: 'categoria', valor: 'villain' }` — usa personajes-tags.js
 *   - `{ kind: 'slugs', valor: ['luffy', 'naruto'] }` — lista explícita
 *   - `{ kind: 'animes', valor: ['One Piece', 'Naruto'] }` — varios animes
 *
 * <p>Reglas de negocio:
 *   - Los eventos NO modifican el ranking ELO global. Son vistas
 *     filtradas + countdown narrativo. El ELO viene del catálogo local
 *     (getStatsPersonaje) — fuente única de verdad consistente con
 *     /ranking tab "ELO actual".
 *   - Las fechas son ISO en UTC. El cálculo de "activo/próximo/pasado"
 *     compara con Date.now() cliente — suficiente para una temporada
 *     de días/semanas, no para algo segundo-preciso.
 */

/**
 * Ancla rodante: el lunes 00:00 UTC de la SEMANA en curso, calculado UNA vez
 * al cargar el módulo. Los eventos se fechan relativos a este ancla por
 * semanas, así que la cartelera SIEMPRE tiene ≥1 ACTIVO y ≥1 PROXIMO sin
 * depender de fechas fijas que caducan. Esto es cálculo de DATOS en
 * module-load (determinista para todo el árbol de un mismo render); el RENDER
 * sigue sin tocar `Date.now()` — usa `getEstadoEvento(evento, now)` con el
 * `now` que le pasa el caller.
 *
 * Trade-off frente a fechas ISO fijas: ganamos "nunca caduca" a cambio de que
 * dos cargas en semanas distintas vean fechas distintas (irrelevante para una
 * vitrina narrativa; los tests pasan un `now` explícito).
 */
const DIA_MS = 24 * 60 * 60 * 1000
const SEMANA_MS = 7 * DIA_MS

function lunesDeEstaSemanaUTC() {
  const ahora = new Date()
  const base = Date.UTC(
    ahora.getUTCFullYear(),
    ahora.getUTCMonth(),
    ahora.getUTCDate(),
  )
  // getUTCDay: 0=domingo … 6=sábado. Retrocede al lunes (1) de la semana.
  const offsetALunes = (new Date(base).getUTCDay() + 6) % 7
  return base - offsetALunes * DIA_MS
}

const LUNES = lunesDeEstaSemanaUTC()

/** ISO de un instante a `semanas` del lunes ancla, con offset de días/horas. */
function isoSemana(semanas, { dia = 0, finDeDia = false } = {}) {
  const t = LUNES + semanas * SEMANA_MS + dia * DIA_MS
  const d = new Date(t)
  // 999ms (no 0): el evento siguiente arranca el lunes 00:00:00.000, así no queda
  // un hueco sin ACTIVO en la franja domingo 23:59:59.x (ni con pestaña abierta).
  if (finDeDia) d.setUTCHours(23, 59, 59, 999)
  return d.toISOString()
}

export const EVENTOS = [
  {
    // ACTIVO: arrancó al inicio de esta semana, termina al final.
    slug: 'arco-husbandos',
    titulo: 'Arco Husbandos',
    descripcionCorta: 'Los personajes masculinos más adorados de la fandom',
    tipo: { kind: 'categoria', valor: 'husbando' },
    inicioISO: isoSemana(0),
    finISO: isoSemana(0, { dia: 6, finDeDia: true }),
    color: 'violet',
    emoji: '🗡️',
  },
  {
    // PROXIMO: empieza el lunes que viene.
    slug: 'copa-villanos',
    titulo: 'Copa Villanos',
    descripcionCorta: 'Los antagonistas más temidos del anime cara a cara',
    tipo: { kind: 'categoria', valor: 'villain' },
    inicioISO: isoSemana(1),
    finISO: isoSemana(1, { dia: 6, finDeDia: true }),
    color: 'rose',
    emoji: '😈',
  },
  {
    // PROXIMO: dentro de dos semanas.
    slug: 'semana-one-piece',
    titulo: 'Semana de One Piece',
    descripcionCorta: 'Los Sombrero de Paja conquistan AnimeShowdown',
    tipo: { kind: 'anime', valor: 'One Piece' },
    inicioISO: isoSemana(2),
    finISO: isoSemana(2, { dia: 6, finDeDia: true }),
    color: 'amber',
    emoji: '🏴‍☠️',
  },
  {
    // PASADO: terminó la semana anterior (la cartelera necesita historial).
    slug: 'top-waifus',
    titulo: 'Top Waifus',
    descripcionCorta: 'Las personajes femeninas más icónicas del anime',
    tipo: { kind: 'categoria', valor: 'waifu' },
    inicioISO: isoSemana(-1),
    finISO: isoSemana(-1, { dia: 6, finDeDia: true }),
    color: 'pink',
    emoji: '💖',
  },
]

/** Estados de evento — para que los consumidores no parsen fechas a mano. */
export const ESTADO_EVENTO = {
  ACTIVO: 'ACTIVO',
  PROXIMO: 'PROXIMO',
  PASADO: 'PASADO',
}

export function getEstadoEvento(evento, now = new Date()) {
  const inicio = new Date(evento.inicioISO)
  const fin = new Date(evento.finISO)
  if (now < inicio) return ESTADO_EVENTO.PROXIMO
  if (now > fin) return ESTADO_EVENTO.PASADO
  return ESTADO_EVENTO.ACTIVO
}

/**
 * Las funciones de consulta aceptan una `lista` de eventos (default: el
 * hardcode `EVENTOS`). El front pasa la lista del backend (`/api/eventos`)
 * vía `useEventos()`, que cae al hardcode si la API está vacía o falla —
 * así la fuente de verdad migra a runtime sin tocar estos helpers ni los
 * consumidores. La capa de fechas (estado/countdown) es idéntica para
 * ambos orígenes porque comparten el mismo shape.
 */

/** Todos los activos en el momento del cálculo. Puede ser >1 simultáneo. */
export function getEventosActivos(now = new Date(), lista = EVENTOS) {
  return lista.filter((e) => getEstadoEvento(e, now) === ESTADO_EVENTO.ACTIVO)
}

/**
 * Evento "headline" para mostrar en Pulso — el primer ACTIVO si lo hay,
 * o el PROXIMO más cercano si no. Null si no hay ni activo ni próximo
 * (el caller esconde la card en ese caso).
 */
export function getEventoHeadline(now = new Date(), lista = EVENTOS) {
  const activos = getEventosActivos(now, lista)
  if (activos.length > 0) return activos[0]
  const proximos = lista
    .filter((e) => getEstadoEvento(e, now) === ESTADO_EVENTO.PROXIMO)
    .sort((a, b) => new Date(a.inicioISO) - new Date(b.inicioISO))
  return proximos[0] ?? null
}

export function getEventosProximos(now = new Date(), lista = EVENTOS) {
  return lista
    .filter((e) => getEstadoEvento(e, now) === ESTADO_EVENTO.PROXIMO)
    .sort((a, b) => new Date(a.inicioISO) - new Date(b.inicioISO))
}

export function getEventosPasados(now = new Date(), lista = EVENTOS) {
  return lista
    .filter((e) => getEstadoEvento(e, now) === ESTADO_EVENTO.PASADO)
    .sort((a, b) => new Date(b.finISO) - new Date(a.finISO))
}

export function getEventoPorSlug(slug, lista = EVENTOS) {
  return lista.find((e) => e.slug === slug) ?? null
}

/**
 * Aplica el filtro del evento sobre la lista de personajes. No ordena
 * ni inyecta stats — esa lógica vive en el caller (típicamente
 * EventoDetailPage que mezcla con getStatsPersonaje y ordena por ELO).
 */
export function getPersonajesEvento(evento, lista = personajes) {
  if (!evento?.tipo) return []
  const { kind, valor } = evento.tipo
  switch (kind) {
    case 'anime':
      return lista.filter((p) => p.anime === valor)
    case 'animes':
      return lista.filter((p) => valor.includes(p.anime))
    case 'slugs':
      return lista.filter((p) => valor.includes(p.slug))
    case 'categoria':
      return lista.filter((p) => getCategoriasPersonaje(p.slug).includes(valor))
    default:
      return []
  }
}

/**
 * Devuelve cuánto falta para que el evento cambie de estado. Si está
 * activo, ms hasta su fin. Si está próximo, ms hasta su inicio. Si está
 * pasado, 0. El frontend renderiza esto como "Termina en 2d 4h" o
 * "Empieza en 3d".
 */
export function getMsRestantes(evento, now = new Date()) {
  const inicio = new Date(evento.inicioISO)
  const fin = new Date(evento.finISO)
  if (now < inicio) return Math.max(0, inicio.getTime() - now.getTime())
  if (now <= fin) return Math.max(0, fin.getTime() - now.getTime())
  return 0
}

/**
 * Formato humano del tiempo restante: "3d 12h", "5h 30m", "12m".
 * Sin lib externa — el evento usa días/horas, segundos no aportan.
 */
export function formatRestante(ms) {
  if (ms <= 0) return ''
  const totalMin = Math.floor(ms / 60000)
  const dias = Math.floor(totalMin / (60 * 24))
  const horas = Math.floor((totalMin % (60 * 24)) / 60)
  const minutos = totalMin % 60
  if (dias > 0) return `${dias}d ${horas}h`
  if (horas > 0) return `${horas}h ${minutos}m`
  return `${minutos}m`
}
