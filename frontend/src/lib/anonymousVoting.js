const COUNT_KEY = 'animeshowdown.anon_votes_count'

// Tope de votos que un invitado puede emitir antes de que se le pida cuenta.
// Única fuente de verdad, compartida por VotarPage (gate de voto) y
// DailyMissionPanel (copy del objetivo). Vive aquí, en el lib de voto
// anónimo, para no crear un ciclo de imports página<->componente.
export const ANON_VOTE_LIMIT = 5

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // El voto invitado no debe depender de localStorage en privacy mode.
  }
}

export function getAnonymousVotesCount() {
  const raw = Number(safeStorageGet(COUNT_KEY) || '0')
  return Number.isFinite(raw) ? raw : 0
}

export function incrementAnonymousVotesCount() {
  const next = getAnonymousVotesCount() + 1
  safeStorageSet(COUNT_KEY, String(next))
  return next
}
