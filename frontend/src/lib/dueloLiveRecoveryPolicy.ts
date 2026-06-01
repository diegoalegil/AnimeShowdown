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
