import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { SoundProvider, useSound } from './SoundContext'

const sentryMock = vi.hoisted(() => ({
  captureException: vi.fn(),
}))

const soundsMock = vi.hoisted(() => ({
  __warm: vi.fn(),
  playClick: vi.fn(),
}))

vi.mock('../lib/sentry', () => ({
  Sentry: {
    captureException: sentryMock.captureException,
  },
}))

vi.mock('../lib/sounds', () => soundsMock)

function PlayProbe() {
  const { play } = useSound()
  return <button onClick={() => play('playClick')}>play</button>
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SoundProvider', () => {
  it('reporta errores síncronos de audio sin lanzar otro error', () => {
    const audioError = new Error('audio boom')
    soundsMock.playClick.mockImplementationOnce(() => {
      throw audioError
    })

    render(
      <SoundProvider>
        <PlayProbe />
      </SoundProvider>,
    )

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'play' }))).not.toThrow()
    expect(sentryMock.captureException).toHaveBeenCalledWith(audioError, { level: 'warning' })
  })
})
