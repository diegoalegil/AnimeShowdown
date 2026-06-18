import { cutUrl, hasCut } from '../../lib/cuts'
import { getAnimeIdentity } from '../../data/anime-identities'
import { slugifyAnime } from '../../lib/animes'
import { imagenPersonaje } from '../../lib/personajes-core'

/**
 * Props de <DepthCard> para una carta ESPECIAL con recorte disponible, o null
 * si no aplica (no es especial, o el personaje no tiene recorte). Única fuente
 * de la decisión "esta carta del álbum luce como carta 2.5D" — módulo hermano
 * (función pura, fuera del .jsx por react-refresh). El bg es el arte de autor de
 * la especial (cae a la imagen del catálogo); el recorte rompe el marco.
 * @param {{rareza?:string, personajeSlug?:string, personajeNombre?:string, anime?:string, arteUrl?:string}} carta
 * @returns {{bgSrc:string, cutoutSrc:string, name:string, anime:string, kanji:string, kanjiMeaning:string} | null}
 */
export function buildDepthCardProps(carta) {
  if (!carta || carta.rareza !== 'ESPECIAL' || !hasCut(carta.personajeSlug)) return null
  const id = getAnimeIdentity(slugifyAnime(carta.anime), carta.anime)
  return {
    bgSrc: carta.arteUrl ?? imagenPersonaje(carta.personajeSlug),
    cutoutSrc: cutUrl(carta.personajeSlug),
    name: carta.personajeNombre,
    anime: carta.anime,
    kanji: id.kanji,
    kanjiMeaning: id.emblem,
  }
}
