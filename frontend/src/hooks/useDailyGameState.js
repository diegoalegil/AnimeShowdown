import { useCallback, useEffect, useMemo, useState } from 'react'
import { fechaDelDia, getDailyResetCountdown, safeStorage } from '../lib/games'

const MAX_TIMEOUT = 2_147_483_647

export function useTodayKey() {
  const [todayKey, setTodayKey] = useState(() => fechaDelDia())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    let timeoutId
    const refresh = () => setTodayKey(fechaDelDia())
    const scheduleMidnightRefresh = () => {
      const delay = Math.min(getDailyResetCountdown().ms + 1_000, MAX_TIMEOUT)
      timeoutId = window.setTimeout(() => {
        refresh()
        scheduleMidnightRefresh()
      }, delay)
    }

    scheduleMidnightRefresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return todayKey
}

function readStoredState(storageKey, fallback, normalize, todayKey) {
  const raw = safeStorage.get(storageKey)
  if (!raw) return normalize(fallback, todayKey)

  try {
    return normalize(JSON.parse(raw), todayKey)
  } catch {
    return normalize(fallback, todayKey)
  }
}

export function useDailyGameState({
  initialState,
  normalize = (value) => value,
  storageKeyPrefix,
}) {
  const todayKey = useTodayKey()
  const storageKey = useMemo(
    () => `${storageKeyPrefix}:${todayKey}`,
    [storageKeyPrefix, todayKey],
  )
  const readState = useCallback(
    () => readStoredState(storageKey, initialState, normalize, todayKey),
    [initialState, normalize, storageKey, todayKey],
  )
  const [snapshot, setSnapshot] = useState(() => ({
    state: readState(),
    storageKey,
  }))
  let currentSnapshot = snapshot
  if (snapshot.storageKey !== storageKey) {
    currentSnapshot = {
      state: readState(),
      storageKey,
    }
    setSnapshot(currentSnapshot)
  }

  const setDailyState = useCallback(
    (nextValue) => {
      setSnapshot((current) => {
        const resolved =
          typeof nextValue === 'function' ? nextValue(current.state) : nextValue
        const nextState = normalize(resolved, todayKey)
        safeStorage.set(storageKey, JSON.stringify(nextState))
        return {
          state: nextState,
          storageKey,
        }
      })
    },
    [normalize, storageKey, todayKey],
  )

  return [currentSnapshot.state, setDailyState, { storageKey, todayKey }]
}
