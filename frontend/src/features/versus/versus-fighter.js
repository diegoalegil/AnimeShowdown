import { getAnimeIdentity } from '../../data/anime-identities'
import { slugifyAnime } from '../../lib/animes'

/**
 * Adapta un personaje del catálogo al shape que consume <VersusIntro> /
 * <VersusIntroOverlay>. Módulo hermano (pura función, fuera de los .jsx por
 * react-refresh) reutilizado por la ficha de duelo (/versus) y por la intro
 * de sesión de /votar.
 * @param {{slug:string, nombre:string, anime:string}} personaje
 * @returns {{slug:string, name:string, series:string, kanji:string}}
 */
export function toFighter(personaje) {
  // Kanji del universo (cae al genérico 界 si el anime no tiene identidad curada).
  const kanji = getAnimeIdentity(slugifyAnime(personaje.anime), personaje.anime).kanji
  return {
    slug: personaje.slug,
    name: personaje.nombre,
    series: personaje.anime,
    kanji,
  }
}
