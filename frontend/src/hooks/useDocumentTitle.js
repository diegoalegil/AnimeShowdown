import { useEffect } from 'react'

const BASE = 'AnimeShowdown'

export function useDocumentTitle(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${BASE}` : `${BASE} — Torneos de personajes de anime`
    return () => {
      document.title = `${BASE} — Torneos de personajes de anime`
    }
  }, [titulo])
}
