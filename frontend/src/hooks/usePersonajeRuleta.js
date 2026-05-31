import { useCallback, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { endpoints } from '../lib/api'

export const ROULETTE_LAST_SLUG_STORAGE = 'animeshowdown.ruleta.lastSlug'

export function getPersonajeSlugFromPath(pathname) {
  const match = /^\/personajes\/([^/?#]+)/.exec(pathname || '')
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function readLastRouletteSlug() {
  try {
    return sessionStorage.getItem(ROULETTE_LAST_SLUG_STORAGE)
  } catch {
    return null
  }
}

function writeLastRouletteSlug(slug) {
  try {
    sessionStorage.setItem(ROULETTE_LAST_SLUG_STORAGE, slug)
  } catch {
    // Safari private mode can reject storage writes; navigation still works.
  }
}

function getErrorMessage(err) {
  return err instanceof Error ? err.message : 'Inténtalo de nuevo en unos segundos.'
}

export function usePersonajeRuleta() {
  const navigate = useNavigate()
  const location = useLocation()
  const pendingRef = useRef(false)
  const [isLoading, setIsLoading] = useState(false)

  const girarRuleta = useCallback(async () => {
    if (pendingRef.current) return null
    pendingRef.current = true
    setIsLoading(true)
    try {
      const currentSlug = getPersonajeSlugFromPath(location.pathname)
      const exclude = currentSlug || readLastRouletteSlug() || undefined
      const personaje = await endpoints.personajeAleatorio({ exclude })
      if (!personaje || typeof personaje.slug !== 'string') {
        throw new Error('La ruleta no devolvió un personaje válido.')
      }
      writeLastRouletteSlug(personaje.slug)
      navigate(`/personajes/${encodeURIComponent(personaje.slug)}`)
      return personaje
    } catch (err) {
      toast.error('No pudimos girar la ruleta', {
        description: getErrorMessage(err),
      })
      return null
    } finally {
      pendingRef.current = false
      setIsLoading(false)
    }
  }, [location.pathname, navigate])

  return { girarRuleta, isLoading }
}
