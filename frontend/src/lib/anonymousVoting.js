const SESSION_KEY = 'animeshowdown.anon_vote_session'
const COUNT_KEY = 'animeshowdown.anon_votes_count'
const FINGERPRINT_KEY = 'animeshowdown.anon_vote_fingerprint'

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

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

export function getAnonymousVoteSessionId({ create = true } = {}) {
  let sessionId = safeStorageGet(SESSION_KEY)
  if (!sessionId && create) {
    sessionId = randomId()
    safeStorageSet(SESSION_KEY, sessionId)
  }
  return sessionId
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

function hashString(value) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export function getAnonymousFingerprint() {
  let fingerprint = safeStorageGet(FINGERPRINT_KEY)
  if (!fingerprint) {
    const screenPart =
      typeof screen === 'undefined'
        ? 'screen:unknown'
        : `${screen.width}x${screen.height}x${screen.colorDepth}`
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'tz:unknown'
    const raw = [
      navigator.userAgent || '',
      navigator.language || '',
      screenPart,
      tz,
    ].join('|')
    fingerprint = hashString(raw)
    safeStorageSet(FINGERPRINT_KEY, fingerprint)
  }
  return fingerprint
}

export function getAnonymousVoteHeaders() {
  return {
    'X-AS-Anonymous-Id': getAnonymousVoteSessionId(),
    'X-AS-Anonymous-Fingerprint': getAnonymousFingerprint(),
  }
}
