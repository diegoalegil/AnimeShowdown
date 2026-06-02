const COUNT_KEY = 'animeshowdown.anon_votes_count'

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
