import { personajes, getPopularidad, getStatsPersonaje } from '../data/personajes'

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
  'Attack on Titan': ['snk', 'shingeki', 'shingeki no kyojin'],
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
  'Spy x Family': ['spy family', 'anya'],
  'Dragon Ball': ['goku', 'dbz', 'db'],
  'Vinland Saga': ['vinland'],
  'Made in Abyss': ['abyss'],
  'Steins Gate': ['steins', 'steinsgate', 'el psy congroo'],
  'Bunny Girl Senpai': ['bunny girl', 'bunny girl senpai', 'mai sakurajima', 'seishun buta yarou'],
}

// Lista de animes con datos competitivos pre-calculados. Construida una
// sola vez al cargar el módulo (catálogo es inmutable en runtime). Las
// páginas que la consumen no necesitan recalcular nada.
export const animesCatalogo = (() => {
  const groups = {}
  for (const p of personajes) {
    if (!groups[p.anime]) groups[p.anime] = []
    groups[p.anime].push(p)
  }
  return Object.entries(groups).map(([anime, list]) => {
    const stats = list.map((p) => ({
      ...p,
      ...getStatsPersonaje(p.slug),
      popularidad: getPopularidad(p.slug),
    }))
    // Top por ELO para la portada y datos competitivos.
    const porElo = [...stats].sort((a, b) => b.elo - a.elo)
    // Top por popularidad para complementar la portada — combinación de
    // los 2 ejes (relevancia narrativa + rendimiento) según la propuesta.
    const porPopularidad = [...stats].sort(
      (a, b) => b.popularidad - a.popularidad,
    )
    const topElo = porElo[0]
    const eloPromedio = Math.round(
      stats.reduce((a, p) => a + p.elo, 0) / stats.length,
    )
    // Selección de portada: 2 por popularidad + 2 por ELO (sin dups).
    // Garantiza que el protagonista (alto popularidad) aparezca aunque
    // su ELO sea bajo, y que el mejor competidor aparezca aunque sea
    // secundario en la trama.
    const slugsCovered = new Set()
    const portada = []
    for (const p of porPopularidad) {
      if (portada.length >= 2) break
      if (slugsCovered.has(p.slug)) continue
      portada.push(p)
      slugsCovered.add(p.slug)
    }
    for (const p of porElo) {
      if (portada.length >= 4) break
      if (slugsCovered.has(p.slug)) continue
      portada.push(p)
      slugsCovered.add(p.slug)
    }
    return {
      anime,
      slug: slugifyAnime(anime),
      personajes: list,
      total: list.length,
      topElo,
      eloPromedio,
      porElo,
      porPopularidad,
      portada,
      aliases: ALIASES[anime] ?? [],
    }
  })
})()

// Lookup por slug. O(n) pero n=70 animes, no merece Map.
export function getAnimePorSlug(slug) {
  return animesCatalogo.find((a) => a.slug === slug) ?? null
}

// Buscador: matchea por nombre real, slug o alias. Case insensitive,
// sin acentos. Usado por el input del catálogo de animes.
export function buscarAnimes(query) {
  if (!query) return animesCatalogo
  const q = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
  return animesCatalogo.filter((a) => {
    if (a.anime.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)) return true
    if (a.slug.includes(q.replace(/\s+/g, '-'))) return true
    return a.aliases.some((alias) => alias.toLowerCase().includes(q))
  })
}
