import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

import PushSubscriptionSync from './PushSubscriptionSync'

const { mockUseAuth, mockEndpoints } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockEndpoints: {
    pushPublicKey: vi.fn(),
    pushSubscribe: vi.fn(),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('../lib/api', () => ({
  endpoints: mockEndpoints,
}))

const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  toJSON: () => ({ keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' } }),
  getKey: () => null,
}

type ServiceWorkerMock = {
  getRegistration: ReturnType<typeof vi.fn>
  ready: Promise<unknown>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

function prepararEntornoPush({
  permission = 'granted',
  localSubscription = subscription as unknown,
} = {}) {
  const registration = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(localSubscription),
      subscribe: vi.fn().mockResolvedValue(subscription),
    },
  }
  const serviceWorker: ServiceWorkerMock = {
    getRegistration: vi.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    value: serviceWorker,
    configurable: true,
  })
  Object.defineProperty(window, 'PushManager', {
    value: function PushManager() {},
    configurable: true,
  })
  Object.defineProperty(window, 'Notification', {
    value: { permission },
    configurable: true,
  })
  return { serviceWorker, registration }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockUseAuth.mockReturnValue({ user: { username: 'ana' } })
  mockEndpoints.pushSubscribe.mockResolvedValue({})
  mockEndpoints.pushPublicKey.mockResolvedValue({ enabled: true, publicKey: 'aGkh' })
})

afterEach(() => cleanup())

describe('PushSubscriptionSync', () => {
  it('re-POSTea la suscripcion local al montar con sesion y permiso', async () => {
    prepararEntornoPush()

    render(<PushSubscriptionSync />)

    await waitFor(() => expect(mockEndpoints.pushSubscribe).toHaveBeenCalledWith({
      endpoint: subscription.endpoint,
      keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' },
    }))
  })

  it('respeta el throttle de 24h por endpoint', async () => {
    prepararEntornoPush()
    localStorage.setItem(
      'animeshowdown.push.resync.v1',
      JSON.stringify({ endpoint: subscription.endpoint, at: Date.now() }),
    )

    render(<PushSubscriptionSync />)

    // Da margen al efecto async antes de asertar la ausencia de llamada.
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(mockEndpoints.pushSubscribe).not.toHaveBeenCalled()
  })

  it('un push-subscription-change del SW fuerza el re-registro saltando el throttle', async () => {
    const { serviceWorker } = prepararEntornoPush()
    localStorage.setItem(
      'animeshowdown.push.resync.v1',
      JSON.stringify({ endpoint: subscription.endpoint, at: Date.now() }),
    )

    render(<PushSubscriptionSync />)

    await waitFor(() => expect(serviceWorker.addEventListener).toHaveBeenCalled())
    const onMessage = serviceWorker.addEventListener.mock.calls
      .find(([tipo]: [string]) => tipo === 'message')?.[1] as (event: unknown) => void
    onMessage({ data: { type: 'push-subscription-change' } })

    await waitFor(() => expect(mockEndpoints.pushSubscribe).toHaveBeenCalled())
  })

  it('re-suscribe desde la pagina si el SW no pudo y no hay suscripcion local', async () => {
    const { serviceWorker, registration } = prepararEntornoPush({ localSubscription: null })

    render(<PushSubscriptionSync />)

    await waitFor(() => expect(serviceWorker.addEventListener).toHaveBeenCalled())
    const onMessage = serviceWorker.addEventListener.mock.calls
      .find(([tipo]: [string]) => tipo === 'message')?.[1] as (event: unknown) => void
    onMessage({ data: { type: 'push-subscription-change' } })

    await waitFor(() => expect(registration.pushManager.subscribe).toHaveBeenCalled())
    await waitFor(() => expect(mockEndpoints.pushSubscribe).toHaveBeenCalled())
  })

  it('no hace nada sin permiso de notificaciones', async () => {
    prepararEntornoPush({ permission: 'denied' })

    render(<PushSubscriptionSync />)

    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(mockEndpoints.pushSubscribe).not.toHaveBeenCalled()
  })

  it('no hace nada sin usuario logueado', async () => {
    prepararEntornoPush()
    mockUseAuth.mockReturnValue({ user: null })

    render(<PushSubscriptionSync />)

    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(mockEndpoints.pushSubscribe).not.toHaveBeenCalled()
  })
})
