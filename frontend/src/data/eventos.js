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

export const EVENTOS = [
  {
    slug: 'arco-husbandos',
    titulo: 'Arco Husbandos',
    descripcionCorta: 'Los personajes masculinos más adorados de la fandom',
    tipo: { kind: 'categoria', valor: 'husbando' },
    inicioISO: '2026-05-25T00:00:00Z',
    finISO: '2026-06-01T23:59:59Z',
    color: 'violet',
    emoji: '🗡️',
  },
  {
    slug: 'copa-villanos',
    titulo: 'Copa Villanos',
    descripcionCorta: 'Los antagonistas más temidos del anime cara a cara',
    tipo: { kind: 'categoria', valor: 'villain' },
    inicioISO: '2026-05-18T00:00:00Z',
    finISO: '2026-05-25T23:59:59Z',
    color: 'rose',
    emoji: '😈',
  },
  {
    slug: 'semana-one-piece',
    titulo: 'Semana de One Piece',
    descripcionCorta: 'Los Sombrero de Paja conquistan AnimeShowdown',
    tipo: { kind: 'anime', valor: 'One Piece' },
    inicioISO: '2026-05-13T00:00:00Z',
    finISO: '2026-05-20T23:59:59Z',
    color: 'amber',
    emoji: '🏴‍☠️',
  },
  {
    slug: 'top-waifus',
    titulo: 'Top Waifus',
    descripcionCorta: 'Las personajes femeninas más icónicas del anime',
    tipo: { kind: 'categoria', valor: 'waifu' },
    inicioISO: '2026-05-05T00:00:00Z',
    finISO: '2026-05-12T23:59:59Z',
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

/** Todos los activos en el momento del cálculo. Puede ser >1 simultáneo. */
export function getEventosActivos(now = new Date(), eventos = EVENTOS) {
  return eventos.filter((e) => getEstadoEvento(e, now) === ESTADO_EVENTO.ACTIVO)
}

/**
 * Evento "headline" para mostrar en Pulso — el primer ACTIVO si lo hay,
 * o el PROXIMO más cercano si no. Null si no hay ni activo ni próximo
 * (el caller esconde la card en ese caso).
 */
export function getEventoHeadline(now = new Date(), eventos = EVENTOS) {
  const activos = getEventosActivos(now, eventos)
  if (activos.length > 0) return activos[0]
  const proximos = eventos
    .filter((e) => getEstadoEvento(e, now) === ESTADO_EVENTO.PROXIMO)
    .sort((a, b) => new Date(a.inicioISO) - new Date(b.inicioISO))
  return proximos[0] ?? null
}

export function getEventosProximos(now = new Date(), eventos = EVENTOS) {
  return eventos
    .filter((e) => getEstadoEvento(e, now) === ESTADO_EVENTO.PROXIMO)
    .sort((a, b) => new Date(a.inicioISO) - new Date(b.inicioISO))
}

export function getEventosPasados(now = new Date(), eventos = EVENTOS) {
  return eventos
    .filter((e) => getEstadoEvento(e, now) === ESTADO_EVENTO.PASADO)
    .sort((a, b) => new Date(b.finISO) - new Date(a.finISO))
}

export function getEventoPorSlug(slug, eventos = EVENTOS) {
  return eventos.find((e) => e.slug === slug) ?? null
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
      return lista
        .filter((p) => valor.includes(p.slug))
        .sort((a, b) => valor.indexOf(a.slug) - valor.indexOf(b.slug))
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
