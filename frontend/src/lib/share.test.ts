import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { absoluteUrl, shareOrCopy } from './share'

// ─── absoluteUrl ──────────────────────────────────────────────────────────────

describe('absoluteUrl', () => {
  it('builds URL for root path', () => {
    const url = absoluteUrl('/')
    expect(url).toMatch(/^(https?:\/\/)?[\w.-]+/)
  })

  it('builds URL for a given path', () => {
    const url = absoluteUrl('/ranking')
    expect(url).toMatch(/\/ranking$/)
  })
})

// ─── shareOrCopy — navigator.share paths ───────────────────────────────────────

describe('shareOrCopy — navigator.share available', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns "native" when navigator.share resolves', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockResolvedValue(undefined) })
    const result = await shareOrCopy({ title: 'Test', text: 'Hello', url: '/foo' })
    expect(result).toBe('native')
  })

  it('returns "cancelled" on AbortError from navigator.share', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('User cancelled', 'AbortError')) })
    const result = await shareOrCopy({ text: 'Hello' })
    expect(result).toBe('cancelled')
  })

  it('falls through to clipboard when share rejects with non-AbortError', async () => {
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(new Error('Generic error')),
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const result = await shareOrCopy({ url: '/bar' })
    expect(result).toBe('clipboard')
  })
})

// ─── shareOrCopy — clipboard fallback ──────────────────────────────────────────

describe('shareOrCopy — clipboard fallback (no navigator.share)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns "clipboard" when no share is available', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    const result = await shareOrCopy({ url: '/' })
    expect(result).toBe('clipboard')
  })

  it('copies text and url joined by a newline', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await shareOrCopy({ text: 'Check this', url: '/page' })
    const calledWith = writeText.mock.calls[0][0] as string
    expect(calledWith).toContain('Check this')
    expect(calledWith).toContain('/page')
    expect(calledWith).toContain('\n')
  })

  it('copies only the url when no text is provided', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await shareOrCopy({ url: '/share' })
    const calledWith = writeText.mock.calls[0][0] as string
    expect(calledWith.trim()).toMatch(/\/share$/)
  })

  it('throws when neither share nor clipboard are available', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined })
    await expect(shareOrCopy({ url: '/' })).rejects.toThrow()
  })
})

// ─── shareOrCopy — edge cases ───────────────────────────────────────────────────

describe('shareOrCopy — edge cases', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('verifies writeText is called when title defaults to AnimeShowdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await shareOrCopy({ url: '/' })
    expect(writeText).toHaveBeenCalled()
  })

  it('falls back to shareUrl when url is empty string', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await shareOrCopy({ text: 'Text only', url: '' })
    const calledWith = writeText.mock.calls[0][0] as string
    expect(calledWith).toContain('Text only')
    expect(calledWith).toContain('\n')
  })

  it('throws when clipboard.writeText is missing', async () => {
    vi.stubGlobal('navigator', { share: undefined, clipboard: {} })
    await expect(shareOrCopy({ url: '/' })).rejects.toThrow()
  })
})
