import { useEffect, useState } from 'react'

const STORAGE_KEY = 'as.assetFallbackStats.v1'
const EVENT_NAME = 'as:asset-fallback-stats'
const MAX_TRACKED_ERRORS = 20

function emptyStats() {
  return {
    total: 0,
    byCategory: {},
    errors: [],
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
      errors: normalizeErrorEntries(parsed.errors),
      lastUpdated: parsed.lastUpdated ?? null,
    }
  } catch {
    return emptyStats()
  }
}

function writeStats(stats) {
  if (!canUseSessionStorage()) return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: stats }))
  } catch {
    // sessionStorage puede fallar por cuota o modo privado; el tracking no
    // debe romper la UI principal.
  }
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
    errors: current.errors ?? [],
    lastUpdated: new Date().toISOString(),
  }
  writeStats(next)
}

export function trackAssetError({
  src,
  category = 'unknown',
  slug,
  message = 'image-load-error',
} = {}) {
  if (!canUseSessionStorage() || !src) return
  const cleanSrc = String(src)
  const cleanCategory = String(category || 'unknown')
  const now = new Date().toISOString()
  const current = readAssetFallbackStats()
  const key = `${cleanCategory}:${cleanSrc}`
  const previous = current.errors?.find((entry) => entry.key === key)
  const nextEntry = {
    key,
    src: cleanSrc,
    category: cleanCategory,
    slug: slug ? String(slug) : null,
    message,
    count: Number(previous?.count ?? 0) + 1,
    firstAt: previous?.firstAt ?? now,
    lastAt: now,
    path: typeof window !== 'undefined' ? window.location.pathname : null,
  }
  const next = {
    ...current,
    errors: [
      nextEntry,
      ...(current.errors ?? []).filter((entry) => entry.key !== key),
    ].slice(0, MAX_TRACKED_ERRORS),
    lastUpdated: now,
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

function normalizeErrorEntries(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry) => entry?.src)
    .map((entry) => ({
      key: entry.key ?? `${entry.category ?? 'unknown'}:${entry.src}`,
      src: String(entry.src),
      category: String(entry.category ?? 'unknown'),
      slug: entry.slug ? String(entry.slug) : null,
      message: entry.message ? String(entry.message) : 'image-load-error',
      count: Number(entry.count ?? 1),
      firstAt: entry.firstAt ?? entry.lastAt ?? null,
      lastAt: entry.lastAt ?? entry.firstAt ?? null,
      path: entry.path ?? null,
    }))
    .slice(0, MAX_TRACKED_ERRORS)
}
