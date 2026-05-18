import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api.js'

/**
 * Galería multi-imagen oficial del personaje (Plan v2 §4.12 step 1).
 *
 * <p>Llama a {@code GET /api/personajes/{slug}/imagenes}. Backend cachea
 * mal_id 30d y pictures 7d en Caffeine; aquí staleTime 1h para no
 * spamear con cada cambio de slug en la ficha.
 *
 * <p>Devuelve {@code string[]} (lista de URLs Jikan) o array vacío si
 * Jikan no encuentra el personaje, no tiene pictures o el circuit
 * breaker está abierto. 404 si el slug no existe en BBDD.
 */
export function useImagenesPersonaje(slug) {
  return useQuery({
    queryKey: ['personajes', 'imagenes', slug],
    queryFn: () => endpoints.imagenesPersonaje(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 60,
    retry: false,
  })
}
