import { useEffect, useState } from 'react'

const STORAGE_KEY = 'as.assetFallbackStats.v1'
const EVENT_NAME = 'as:asset-fallback-stats'

function emptyStats() {
  return {
    total: 0,
    byCategory: {},
    lastUpdated: null,
  }
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && 'sessionStorage' in window
}

export function readAssetFallbackStats() {
  if (!canUseSessionStorage()) return emptyStats()
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStats()
    const parsed = JSON.parse(raw)
    return {
      total: Number(parsed.total ?? 0),
      byCategory: parsed.byCategory ?? {},
      lastUpdated: parsed.lastUpdated ?? null,
    }
  } catch {
    return emptyStats()
  }
}

function writeStats(stats) {
  if (!canUseSessionStorage()) return
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: stats }))
}

export function trackAssetFallback(category = 'unknown') {
  if (!canUseSessionStorage()) return
  const cleanCategory = String(category || 'unknown')
  const current = readAssetFallbackStats()
  const next = {
    total: current.total + 1,
    byCategory: {
      ...current.byCategory,
      [cleanCategory]: Number(current.byCategory?.[cleanCategory] ?? 0) + 1,
    },
    lastUpdated: new Date().toISOString(),
  }
  writeStats(next)
}

export function clearAssetFallbackStats() {
  if (!canUseSessionStorage()) return
  window.sessionStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: emptyStats() }))
}

export function useAssetFallbackStats() {
  const [stats, setStats] = useState(() => readAssetFallbackStats())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const refresh = () => setStats(readAssetFallbackStats())
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) refresh()
    }
    window.addEventListener(EVENT_NAME, refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENT_NAME, refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return stats
}
