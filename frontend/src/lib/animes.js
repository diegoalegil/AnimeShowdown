import { getPopularidad, getStatsPersonaje, readCatalogoPersonajesSnapshot } from './personajes-core'

// "Slugify" relajado: minúsculas, sin acentos/caracteres raros, espacios y
// símbolos a guión. Mantiene paridad con el patrón Wordpress/CMS clásicos.
//   "My Hero Academia" → "my-hero-academia"
//   "Re:Zero kara Hajimeru" → "re-zero-kara-hajimeru"
//   "JoJo's Bizarre Adventure" → "jojo-s-bizarre-adventure"
//
// Defensive guard (2026-05-20): si por una mala data un personaje llega
// con anime null/undefined, devolvemos string vacio en lugar de tirar
// TypeError. PersonajeDetailPage usa el resultado como expectedPath de
// `/assets/anime-banners/${slug}.webp` — un slug vacio cae al fallback
// editorial del catalogo en lugar de romper el ErrorBoundary global.
export function slugifyAnime(nombre) {
  if (typeof nombre !== 'string' || nombre.length === 0) return ''
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Aliases cortos / nombres alternativos comunes para mejorar el buscador.
// "kimetsu" debería encontrar Demon Slayer, "snk" Attack on Titan, etc.
const ALIASES = {
  'Attack on Titan': ['aot', 'snk', 'shingeki', 'shingeki no kyojin'],
  'Demon Slayer': ['kimetsu', 'kimetsu no yaiba'],
  'My Hero Academia': ['boku no hero', 'mha', 'bnha', 'hero aca'],
  'Jujutsu Kaisen': ['jjk'],
  'Chainsaw Man': ['csm', 'chainsawman'],
  'Code Geass': ['lelouch', 'geass'],
  'Death Note': ['ryuk', 'kira'],
  'Fullmetal Alchemist': ['fma', 'hagane'],
  'One Piece': ['op', 'mugiwara'],
  'Sword Art Online': ['sao'],
  'Re:Zero': ['rezero', 're zero', 'rem', 'subaru'],
  'Bleach': ['shinigami', 'soul reaper'],
  'Naruto': ['ninja'],
  'Hunter x Hunter': ['hxh', 'hunter hunter'],
  'Tokyo Ghoul': ['ghoul', 'kaneki'],
  'Spy × Family': ['spy x family', 'spy family', 'anya', 'loid', 'yor'],
  'Dragon Ball': ['goku', 'dbz', 'db'],
  'Vinland Saga': ['vinland'],
  'Made in Abyss': ['abyss'],
  'Steins Gate': ['steins', 'steinsgate', 'el psy congroo'],
  "Frieren: Beyond Journey's End": ['frieren', 'sousou', 'sousou no frieren', 'beyond journey'],
  'Kaguya-sama: Love is War': ['kaguya', 'kaguya sama', 'love is war', 'shinomiya'],
  'Bunny Girl Senpai': [
    'bunny girl',
    'bunny girl senpai',
    'mai sakurajima',
    'rascal does not dream',
    'seishun buta yarou',
  ],
  'Mazinger Z': ['mazinger', 'mazinger z', 'koji kabuto', 'super robot'],
  'The Angel Next Door Spoils Me Rotten': [
    'angel next door',
    'mahiru shiina',
    'otonari no tenshi',
    'tenshi-sama',
  ],
  'Chuunibyou demo Koi ga Shitai!': [
    'chuunibyou',
    'chu2koi',
    'love chunibyo',
    'rikka takanashi',
  ],
  'Alya Sometimes Hides Her Feelings in Russian': [
    'alya',
    'roshidere',
    'russian alya',
    'alisa mikhailovna',
    'tokidoki bosotto',
  ],
}

export function getAnimeAliases(nombre) {
  return ALIASES[nombre] ?? []
}

function normalizarBusqueda(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function compareAnimeName(a, b) {
  return a.anime.localeCompare(b.anime, 'es', { sensitivity: 'base' })
}

// Memo de getAnimesCatalogo. `buscarAnimes` lo invoca en cada keystroke del
// buscador de animes y el cómputo (agrupar + ordenar por ELO/popularidad +
// stats de ~1000 personajes) es caro; antes se recomputaba entero por tecla y
// además se duplicaba entre la portada y los detalles. Cacheamos por identidad
// del array de catálogo. El catálogo se hidrata mutando el MISMO array in-place
// (ver syncCatalogoPersonajes), así que la referencia no cambia entre el estado
// pre/post hidratación: usamos la longitud como discriminador para invalidar.
const animesCatalogoCache = new WeakMap()

export function getAnimesCatalogo(catalogo = readCatalogoPersonajesSnapshot()) {
  const cached = animesCatalogoCache.get(catalogo)
  if (cached && cached.length === catalogo.length) return cached.result
  const result = computeAnimesCatalogo(catalogo)
  animesCatalogoCache.set(catalogo, { length: catalogo.length, result })
  return result
}

function computeAnimesCatalogo(catalogo) {
  const groups = {}
  for (const p of catalogo) {
    if (!groups[p.anime]) groups[p.anime] = []
    groups[p.anime].push(p)
  }
  return Object.entries(groups).map(([anime, list]) => {
    const stats = list.map((p) => ({
      ...p,
      ...getStatsPersonaje(p.slug),
      popularidad: getPopularidad(p.slug),
    }))
    // Top por ELO base para datos competitivos y ranking interno del anime.
    const porElo = [...stats].sort((a, b) => b.elo - a.elo)
    // Top por popularidad: lo consume AnimeDetailPage para los "destacados".
    const porPopularidad = [...stats].sort(
      (a, b) => b.popularidad - a.popularidad,
    )
    const topElo = porElo[0]
    const eloPromedio = Math.round(
      stats.reduce((a, p) => a + p.elo, 0) / stats.length,
    )
    const slug = slugifyAnime(anime)
    const aliases = getAnimeAliases(anime)
    const destacadoScore = list.length * 8 + (topElo?.elo ?? 0)
    const searchText = [
      anime,
      slug,
      ...aliases,
      ...list.map((p) => p.nombre),
    ]
      .map(normalizarBusqueda)
      .filter(Boolean)
      .join(' ')
    return {
      anime,
      slug,
      personajes: list,
      total: list.length,
      topElo,
      eloPromedio,
      porElo,
      porPopularidad,
      aliases,
      destacadoScore,
      searchText,
    }
  })
}

export function getAnimePorSlug(slug, catalogo) {
  return getAnimesCatalogo(catalogo).find((a) => a.slug === slug) ?? null
}

// Buscador: matchea por nombre real, slug o alias. Case insensitive,
// sin acentos. Usado por el input del catálogo de animes.
export function buscarAnimes(query, catalogo) {
  const animesCatalogo = getAnimesCatalogo(catalogo)
  if (!query) return animesCatalogo
  const q = normalizarBusqueda(query)
  if (!q) return animesCatalogo
  const slugQuery = q.replace(/\s+/g, '-')
  return animesCatalogo.filter(
    (a) => a.searchText.includes(q) || a.slug.includes(slugQuery),
  )
}

const ANIME_SORTERS = {
  destacados: (a, b) =>
    b.destacadoScore - a.destacadoScore || compareAnimeName(a, b),
  personajes: (a, b) => b.total - a.total || compareAnimeName(a, b),
  elo: (a, b) =>
    (b.topElo?.elo ?? 0) - (a.topElo?.elo ?? 0) || compareAnimeName(a, b),
  promedio: (a, b) => b.eloPromedio - a.eloPromedio || compareAnimeName(a, b),
  az: compareAnimeName,
}

export function ordenarAnimesCatalogo(animes, sort = 'destacados') {
  const sorter = ANIME_SORTERS[sort] ?? ANIME_SORTERS.destacados
  return [...animes].sort(sorter)
}

/**
 * @param {{ query?: string, sort?: string, catalogo?: Array<unknown> }} [params]
 */
export function filtrarOrdenarAnimes({
  query = '',
  sort = 'destacados',
  catalogo,
} = {}) {
  return ordenarAnimesCatalogo(buscarAnimes(query, catalogo), sort)
}
