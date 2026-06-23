const RECOVERABLE_STATES = new Set(['WAITING', 'MATCHED', 'IN_PROGRESS'])

export const DUEL_LIVE_POLL_BASE_MS = 4000
export const DUEL_LIVE_POLL_MAX_MS = 15000
export const DUEL_LIVE_PUSH_FRESH_MS = 3500

export function isRecoverableDueloLiveState(estado: string | null | undefined) {
  return typeof estado === 'string' && RECOVERABLE_STATES.has(estado)
}

export function shouldPollDueloLiveFallback({
  user,
  state,
  connected,
  lastPushAt,
  now,
}: {
  user: unknown
  state: { estado?: string | null } | null | undefined
  connected: boolean
  lastPushAt?: number | null
  now?: number
}) {
  if (!user || !isRecoverableDueloLiveState(state?.estado)) return false
  if (!connected) return true
  const lastPush = Number(lastPushAt ?? 0)
  const current = Number(now ?? Date.now())
  return !Number.isFinite(lastPush) || lastPush <= 0 || current - lastPush >= DUEL_LIVE_PUSH_FRESH_MS
}

export function getDueloLivePollDelay(failures: number) {
  const safeFailures = Math.max(0, Math.min(2, Math.floor(Number(failures) || 0)))
  return Math.min(DUEL_LIVE_POLL_MAX_MS, DUEL_LIVE_POLL_BASE_MS * 2 ** safeFailures)
}

/**
 * Guarda de orden contra respuestas fuera de secuencia. El estado del duelo
 * llega por varias vías (push WS, fetch inicial, poll fallback, join/vote/
 * leave); una respuesta HTTP lenta puede aterrizar DESPUÉS de un push WS más
 * nuevo y revertir el duelo a un estado viejo (ronda anterior, marcador
 * desfasado). `serverNow` (epoch ms) lo pone el backend en cada payload, así
 * que es la marca de orden monótona.
 *
 * Una respuesta SIN serverNow (null/NaN) NUNCA se descarta: preferimos aplicar
 * a congelar el duelo (defensivo). Un último-aplicado no finito cuenta como
 * "nada aplicado aún" → cualquier serverNow real lo supera.
 *
 * @returns true si `incomingServerNow` es estrictamente más viejo que el
 *          último aplicado → la respuesta debe DESCARTARSE.
 */
export function isStaleDueloLiveUpdate(
  lastAppliedServerNow: number | null | undefined,
  incomingServerNow: number | null | undefined,
) {
  if (incomingServerNow == null || !Number.isFinite(incomingServerNow)) return false
  const last = Number(lastAppliedServerNow)
  if (!Number.isFinite(last)) return false
  return incomingServerNow < last
}
