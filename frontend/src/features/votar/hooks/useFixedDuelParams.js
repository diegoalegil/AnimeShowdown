import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Duelo fijado por URL, resuelto contra el catálogo local:
 *   ?personaje=slug            → reto con el personaje fijado
 *   ?personaje=slug&rival=slug → duelo exacto (links de "Reta a un amigo")
 *   ?anime=Nombre              → duelo interno del anime
 *
 * casualContextKey identifica el contexto fijado actual — el override del
 * par casual se descarta cuando cambia (p.ej. navegar de un reto a otro).
 */
export function useFixedDuelParams(catalogoPersonajes) {
  const [searchParams] = useSearchParams()
  const fixedSlug = searchParams.get('personaje')
  const fixedRivalSlug = searchParams.get('rival')
  const fixedAnime = searchParams.get('anime')
  const fixedPersonaje = useMemo(
    () => catalogoPersonajes.find((p) => p.slug === fixedSlug) ?? null,
    [catalogoPersonajes, fixedSlug],
  )
  const fixedRival = useMemo(
    () =>
      catalogoPersonajes.find((p) => p.slug === fixedRivalSlug && p.slug !== fixedSlug) ?? null,
    [catalogoPersonajes, fixedRivalSlug, fixedSlug],
  )
  const hasFixedDuel = Boolean(fixedPersonaje && fixedRival)
  const hasFixedAnime = useMemo(
    () =>
      !fixedPersonaje &&
      Boolean(fixedAnime) &&
      catalogoPersonajes.filter((p) => p.anime === fixedAnime).length >= 2,
    [catalogoPersonajes, fixedAnime, fixedPersonaje],
  )
  const casualContextKey = `${fixedSlug || ''}::${fixedRivalSlug || ''}::${fixedAnime || ''}`

  return {
    fixedSlug,
    fixedRivalSlug,
    fixedAnime,
    fixedPersonaje,
    fixedRival,
    hasFixedDuel,
    hasFixedAnime,
    casualContextKey,
  }
}
