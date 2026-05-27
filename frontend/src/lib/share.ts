import { buildUrl } from './buildUrl'
import type { ShareResult } from './types'

type ShareInput = {
  title?: string
  text?: string
  url?: string
}

export function absoluteUrl(path = '/'): string {
  return buildUrl(path)
}

export async function shareOrCopy({
  title = 'AnimeShowdown',
  text,
  url,
}: ShareInput): Promise<ShareResult> {
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
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }

  const copyText = [text, shareUrl].filter(Boolean).join('\n')
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(copyText)
    return 'clipboard'
  }

  throw new Error(copyText)
}
