const RECOVERABLE_STATES = new Set(['WAITING', 'MATCHED', 'IN_PROGRESS'])

export const DUEL_LIVE_POLL_BASE_MS = 4000
export const DUEL_LIVE_POLL_MAX_MS = 15000

export function isRecoverableDueloLiveState(estado: string | null | undefined) {
  return typeof estado === 'string' && RECOVERABLE_STATES.has(estado)
}

export function shouldPollDueloLiveFallback({
  user,
  state,
  connected,
}: {
  user: unknown
  state: { estado?: string | null } | null | undefined
  connected: boolean
}) {
  return Boolean(user) && !connected && isRecoverableDueloLiveState(state?.estado)
}

export function getDueloLivePollDelay(failures: number) {
  const safeFailures = Math.max(0, Math.min(2, Math.floor(Number(failures) || 0)))
  return Math.min(DUEL_LIVE_POLL_MAX_MS, DUEL_LIVE_POLL_BASE_MS * 2 ** safeFailures)
}
