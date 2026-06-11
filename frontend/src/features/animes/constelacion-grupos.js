import { ANIME_IDENTITY_DEFINITIONS } from '../../data/anime-identities'
import { slugifyAnime } from '../../lib/animes'

/**
 * Constructor de los grupos de la vista constelación.
 *
 * Agrupa los universos del CATÁLOGO REAL por su `audioCueKey` (la taxonomía
 * temática de anime-identities: battle/comedy/voyage…), con el conteo real
 * de personajes por anime. Los `TOP_DESTACADOS` universos con más personajes
 * llevan halo carmesí y mayor tamaño en el cielo.
 */

export const TOP_DESTACADOS = 10

// Kanji + nombre de cada constelación. Kanji con significado real:
// 戦 batalla · 笑 risa · 旅 viaje · 謎 misterio · 恋 amor · 学 escuela ·
// 夢 sueño · 魔 arcano · 競 deporte · 恐 terror · 機 máquina · 盤 tablero ·
// 逐 persecución · 歌 himno.
export const CONSTELACIONES = Object.freeze({
  battle: { k: '戦', name: 'Batalla' },
  comedy: { k: '笑', name: 'Comedia' },
  voyage: { k: '旅', name: 'Viaje' },
  mystery: { k: '謎', name: 'Misterio' },
  romance: { k: '恋', name: 'Romance' },
  school: { k: '学', name: 'Escuela' },
  dream: { k: '夢', name: 'Sueño' },
  arcane: { k: '魔', name: 'Arcano' },
  sport: { k: '競', name: 'Deporte' },
  horror: { k: '恐', name: 'Terror' },
  mecha: { k: '機', name: 'Mecha' },
  court: { k: '盤', name: 'Tablero' },
  chase: { k: '逐', name: 'Persecución' },
  anthem: { k: '歌', name: 'Himno' },
})

/**
 * @param {Array<{anime?: string}>} catalogoPersonajes catálogo completo
 * @returns {Array<{k: string, name: string, list: Array<{name, slug, chars, top}>}>}
 *          grupos ordenados por tamaño desc; dentro, universos por personajes desc.
 */
export function construirGruposConstelacion(catalogoPersonajes) {
  const conteoPorSlug = new Map()
  for (const p of catalogoPersonajes ?? []) {
    if (!p?.anime) continue
    const slug = slugifyAnime(p.anime)
    if (!slug) continue
    const actual = conteoPorSlug.get(slug)
    if (actual) {
      actual.chars += 1
    } else {
      conteoPorSlug.set(slug, { name: p.anime, slug, chars: 1 })
    }
  }

  // Solo universos con identidad curada (los 105): el cue da el grupo.
  const universos = []
  for (const identidad of ANIME_IDENTITY_DEFINITIONS) {
    const enCatalogo = conteoPorSlug.get(identidad.slug)
    if (!enCatalogo) continue
    universos.push({
      name: identidad.title,
      slug: identidad.slug,
      chars: enCatalogo.chars,
      cue: identidad.audioCueKey,
    })
  }

  const umbralTop = [...universos]
    .sort((a, b) => b.chars - a.chars)
    .slice(0, TOP_DESTACADOS)
    .reduce((min, u) => Math.min(min, u.chars), Infinity)

  const porCue = new Map()
  for (const u of universos) {
    const grupo = CONSTELACIONES[u.cue] ?? CONSTELACIONES.anthem
    const key = grupo.k
    if (!porCue.has(key)) porCue.set(key, { k: grupo.k, name: grupo.name, list: [] })
    porCue.get(key).list.push({
      name: u.name,
      slug: u.slug,
      chars: u.chars,
      top: u.chars >= umbralTop,
    })
  }

  const grupos = [...porCue.values()]
  for (const g of grupos) g.list.sort((a, b) => b.chars - a.chars)
  grupos.sort((a, b) => b.list.length - a.list.length)
  return grupos
}
