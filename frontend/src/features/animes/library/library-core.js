/**
 * library-core.js — módulo hermano puro de UniverseLibrary (la Biblioteca de
 * los Universos). Cero React, cero DOM: derivación de universos, orden estable,
 * agrupado en estanterías y matching del buscador con normalización de acentos.
 * Testeable en aislamiento (jsdom-safe).
 *
 * Reusa la MISMA semántica de normalización y los MISMOS criterios de orden
 * que el catálogo real (src/lib/animes.js): no hay un segundo "sort propio" de
 * la pieza, las tablillas mapean 1:1 a los SORT_LABELS existentes.
 *
 * @typedef {Object} Universo
 * @property {string} anime          Nombre real del anime (del catálogo).
 * @property {string} slug           Slug canónico (slugifyAnime del catálogo).
 * @property {number} numPersonajes  Nº de personajes del universo (= total).
 * @property {number} eloMedio       ELO base medio del universo (sintético).
 * @property {number} topEloMax      ELO base máximo del universo (sintético).
 * @property {number} destacadoScore Score del orden "destacados" del catálogo.
 * @property {Array<{slug:string,nombre:string}>} top3  Top 3 por ELO base.
 * @property {string} kanji          Kanji de universo curado (o fallback 印).
 * @property {string} [kanjiSignificado] Significado editorial del kanji (caption/tooltip); ausente si no hay entrada curada.
 * @property {string[]} [aliases]    Alias de búsqueda (getAnimeAliases).
 * @property {string} [searchText]   Texto pre-normalizado del catálogo (match).
 * @property {boolean} [eloSintetico] ELO derivado/estimado → se rotula "·b".
 */

/** Sello/marca canónico cuando un anime no tiene kanji editorial curado. */
export const KANJI_DEFECTO = '印' // 印

/** Normaliza para comparar: minúsculas, sin acentos, sin espacios sobrantes. */
export function normalizar(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Deriva los Universos que consume UniverseLibrary a partir de las entradas
 * enriquecidas de getAnimesCatalogo (animes.js) + un mapa de kanji curado.
 *
 * Aditivo y puro: no recomputa stats (animes.js ya las trae como eloMedio/top3);
 * solo reproyecta los campos al contrato `Universo` y resuelve el kanji.
 *
 * @param {Array<Object>} catalogoAnimes  Salida de getAnimesCatalogo.
 * @param {(anime:string)=>(string|undefined)} [kanjiDe]  Resolutor de kanji curado por nombre.
 * @param {(anime:string)=>(string|undefined)} [significadoDe]  Resolutor del significado editorial del kanji.
 * @returns {Universo[]}
 */
export function derivarUniversos(
  catalogoAnimes,
  kanjiDe = () => undefined,
  significadoDe = () => undefined,
) {
  return (catalogoAnimes ?? []).map((a) => ({
    anime: a.anime,
    slug: a.slug,
    numPersonajes: a.total ?? 0,
    eloMedio: a.eloMedio ?? a.eloPromedio ?? 0,
    topEloMax: a.topElo?.elo ?? 0,
    destacadoScore: a.destacadoScore ?? 0,
    top3: a.top3 ?? [],
    aliases: a.aliases ?? [],
    searchText: a.searchText,
    kanji: kanjiDe(a.anime) ?? KANJI_DEFECTO,
    // Significado editorial del kanji (caption/tooltip). Solo cuando hay
    // entrada curada con significado — un fallback 印 jamás lleva caption.
    kanjiSignificado: significadoDe(a.anime),
    // El ELO es sintético (getStatsPersonaje._sintetico) → "·b" / "ELO base".
    eloSintetico: true,
  }))
}

/**
 * ¿El universo casa con la query? Insensible a mayúsculas y acentos. Reusa el
 * `searchText` pre-normalizado del catálogo (nombre + slug + alias + nombres de
 * personajes) si está disponible — misma cobertura que buscarAnimes; si falta
 * (universo construido a mano en tests), reconstruye el heno mínimo.
 * @param {Universo} u
 * @param {string} query
 * @returns {boolean}
 */
export function universoMatches(u, query) {
  const nq = normalizar(query)
  if (!nq) return true
  const slugQuery = nq.replace(/\s+/g, '-')
  const heno =
    u.searchText ??
    [u.anime, u.slug, ...(u.aliases ?? []), ...(u.top3 ?? []).map((t) => t.nombre)]
      .map(normalizar)
      .filter(Boolean)
      .join(' ')
  return heno.includes(nq) || normalizar(u.slug).includes(slugQuery)
}

/**
 * Comparadores = MISMOS criterios que SORT_LABELS / ANIME_SORTERS del catálogo
 * (destacados, personajes, elo, promedio, az). Desempate siempre alfabético
 * para orden determinista (sin azar, sin Date.now()).
 */
function porNombre(a, b) {
  return a.anime.localeCompare(b.anime, 'es', { sensitivity: 'base' })
}
const COMPARADORES = {
  destacados: (a, b) => b.destacadoScore - a.destacadoScore || porNombre(a, b),
  personajes: (a, b) => b.numPersonajes - a.numPersonajes || porNombre(a, b),
  elo: (a, b) => b.topEloMax - a.topEloMax || porNombre(a, b),
  promedio: (a, b) => b.eloMedio - a.eloMedio || porNombre(a, b),
  az: porNombre,
}

/**
 * Orden estable por criterio del catálogo.
 * @param {Universo[]} universos
 * @param {string} [criterio]
 * @returns {Universo[]} copia ordenada
 */
export function ordenarUniversos(universos, criterio = 'destacados') {
  const cmp = COMPARADORES[criterio] ?? COMPARADORES.destacados
  return [...universos].sort(cmp)
}

/**
 * Parte una lista ya ordenada en estanterías de N tomos. Estable: respeta el
 * orden de entrada. La última estantería puede ir incompleta.
 * @param {Universo[]} universos
 * @param {number} [porEstanteria]
 * @returns {Universo[][]}
 */
export function agruparEnEstanterias(universos, porEstanteria = 8) {
  const n = Math.max(1, porEstanteria | 0)
  const out = []
  for (let i = 0; i < universos.length; i += n) {
    out.push(universos.slice(i, i + n))
  }
  return out
}

/**
 * Cuenta cuántos universos casan con la query (para el aria-live del buscador).
 * @param {Universo[]} universos
 * @param {string} query
 * @returns {number}
 */
export function contarResultados(universos, query) {
  if (!normalizar(query)) return universos.length
  let n = 0
  for (const u of universos) if (universoMatches(u, query)) n++
  return n
}

/**
 * Laca determinista por índice (NUNCA Math.random/Date.now en render): reparte
 * tres acabados sobrios — tinta, carmín, madera — de forma estable.
 * @param {number} index
 * @returns {'carmin'|'madera'|'tinta'}
 */
export function lacaPorIndice(index) {
  return ['tinta', 'carmin', 'madera'][((index % 3) + 3) % 3]
}

/**
 * Pipeline completo: ordena, parte en estanterías y marca match por query.
 * Devuelve estanterías de universos enriquecidos con `_match` (boolean) e `_i`
 * (índice global, para el stagger de la caída de canto). No desmonta nada: el
 * consumidor solo conmuta clases con `_match`.
 * @param {Universo[]} universos
 * @param {{ criterio?: string, query?: string, porEstanteria?: number }} [opts]
 * @returns {{ estanterias: Array<Array<Universo & {_match:boolean,_i:number}>>, total:number, visibles:number }}
 */
export function construirBiblioteca(
  universos,
  { criterio = 'destacados', query = '', porEstanteria = 8 } = {},
) {
  const ordenados = ordenarUniversos(universos ?? [], criterio)
  const enriquecidos = ordenados.map((u, i) => ({
    ...u,
    _i: i,
    _match: universoMatches(u, query),
  }))
  return {
    estanterias: agruparEnEstanterias(enriquecidos, porEstanteria),
    total: ordenados.length,
    visibles: enriquecidos.reduce((n, u) => n + (u._match ? 1 : 0), 0),
  }
}
