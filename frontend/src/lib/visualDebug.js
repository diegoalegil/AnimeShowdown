export function isVisualDebugActive() {
  if (!import.meta.env.DEV) return false
  if (typeof window === 'undefined') return false
  const qs = new URLSearchParams(window.location.search)
  const onByQuery = qs.get('debug') === 'visual'
  const onByStorage =
    typeof window.localStorage !== 'undefined' &&
    window.localStorage.getItem('debug') === 'visual'
  return onByQuery || onByStorage
}
