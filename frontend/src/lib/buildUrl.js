const DEFAULT_ORIGIN = 'https://animeshowdown.dev'

function getCurrentOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return DEFAULT_ORIGIN
}

function appendParams(url, params) {
  if (!params) return url

  const entries =
    params instanceof URLSearchParams
      ? Array.from(params.entries())
      : Object.entries(params)

  for (const [key, value] of entries) {
    if (value == null || value === '') continue
    if (Array.isArray(value)) {
      value
        .filter((item) => item != null && item !== '')
        .forEach((item) => url.searchParams.append(key, String(item)))
      continue
    }
    url.searchParams.set(key, String(value))
  }

  return url
}

export function buildUrl(path = '/', params, { origin = getCurrentOrigin() } = {}) {
  const url = appendParams(new URL(path || '/', origin), params)
  return url.toString()
}

export function buildPath(path = '/', params) {
  const url = appendParams(new URL(path || '/', DEFAULT_ORIGIN), params)
  return `${url.pathname}${url.search}${url.hash}`
}
