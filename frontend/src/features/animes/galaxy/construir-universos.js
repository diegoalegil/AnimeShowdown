/**
 * construir-universos.js — arma la lista REAL de universos para la galaxia a
 * partir del catálogo de personajes + las identidades curadas.
 *
 * Cada universo = un anime con identidad curada presente en el catálogo:
 *   { slug, name, kanji, characters[], charCount, top }
 *
 * `top` = los TOP_GALAXIA universos con más personajes (halo oro + núcleo).
 * El array sale ordenado por nº de personajes desc, así los top quedan PRIMERO,
 * que es justo lo que `buildGalaxyLayout` espera para la espiral dorada.
 */

import { ANIME_IDENTITY_DEFINITIONS } from '../../../data/anime-identities'
import { slugifyAnime } from '../../../lib/animes'
import { getPopularidad } from '../../../lib/personajes-core'

export const TOP_GALAXIA = 10
const MAX_CHARS = 3

export function construirUniversosGalaxia(catalogoPersonajes) {
  // Personajes agrupados por slug de anime, con su popularidad para destacar.
  const porAnime = new Map()
  for (const p of catalogoPersonajes ?? []) {
    if (!p?.anime || !p?.slug) continue
    const slug = slugifyAnime(p.anime)
    if (!slug) continue
    const lista = porAnime.get(slug)
    const entry = { slug: p.slug, nombre: p.nombre, pop: getPopularidad(p.slug) }
    if (lista) lista.push(entry)
    else porAnime.set(slug, [entry])
  }

  // Solo universos con identidad curada y presencia real en el catálogo.
  const universos = []
  for (const id of ANIME_IDENTITY_DEFINITIONS) {
    const personajes = porAnime.get(id.slug)
    if (!personajes || personajes.length === 0) continue
    const destacados = [...personajes]
      .sort((a, b) => b.pop - a.pop)
      .slice(0, MAX_CHARS)
      .map((c) => c.nombre)
    universos.push({
      slug: id.slug,
      name: id.title,
      kanji: id.kanji,
      characters: destacados,
      charCount: personajes.length,
    })
  }

  universos.sort((a, b) => b.charCount - a.charCount || a.name.localeCompare(b.name))
  const umbralTop = universos.length
    ? universos[Math.min(TOP_GALAXIA, universos.length) - 1].charCount
    : Infinity

  return universos.map((u) => ({ ...u, top: u.charCount >= umbralTop }))
}
