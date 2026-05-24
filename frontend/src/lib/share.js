export function absoluteUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return path
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://animeshowdown.dev'
  return new URL(path, origin).toString()
}

export async function shareOrCopy({ title = 'AnimeShowdown', text, url }) {
  const shareUrl = absoluteUrl(url || '/')
  const payload = {
    title,
    text,
    url: shareUrl,
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(payload)
      return 'native'
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled'
    }
  }

  const copyText = [text, shareUrl].filter(Boolean).join('\n')
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(copyText)
    return 'clipboard'
  }

  throw new Error(copyText)
}
