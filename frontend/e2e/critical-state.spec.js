import { expect, test } from '@playwright/test'

const CATALOG_STORAGE_KEY = 'animeshowdown.catalogo-personajes.v1'
const TOP5_STORAGE_KEY = 'animeshowdown.mitop5.v1'

const MOCK_USER = {
  id: 9301,
  username: 'state_e2e_user',
  email: 'state-e2e@example.com',
  avatarUrl: null,
  rol: 'USER',
  estadoVerificacion: 'VERIFICADO',
  totpHabilitado: false,
}

const CATALOG = [
  {
    id: 1,
    slug: 'luffy',
    nombre: 'Luffy',
    anime: 'One Piece',
    imagenUrl: '/img/One_Piece/luffy.webp',
    imagenColorDominante: '#c95b3f',
  },
  {
    id: 2,
    slug: 'zoro',
    nombre: 'Zoro',
    anime: 'One Piece',
    imagenUrl: '/img/One_Piece/zoro.webp',
    imagenColorDominante: '#2f8b57',
  },
  {
    id: 3,
    slug: 'naruto',
    nombre: 'Naruto',
    anime: 'Naruto',
    imagenUrl: '/img/Naruto/naruto.webp',
    imagenColorDominante: '#e0a13c',
  },
]

async function prepareBasePage(page) {
  await page.addInitScript((catalog) => {
    localStorage.setItem('animeshowdown.muted', 'true')
    localStorage.setItem('i18nextLng', 'es')
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog))
    sessionStorage.setItem('animeshowdown.splash.shown', 'true')
  }, CATALOG)

  await page.route('**/api/personajes/catalogo**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CATALOG),
    })
  })

  await page.route('**/api/personajes/buscar**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CATALOG),
    })
  })
}

async function prepareAuthedPage(page) {
  await prepareBasePage(page)
  await page.addInitScript((user) => {
    localStorage.setItem('animeshowdown.user', JSON.stringify(user))
  }, MOCK_USER)
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'state-e2e-token', usuario: MOCK_USER }),
    })
  })
}

async function installFakeNotificationSocket(page) {
  await page.addInitScript(() => {
    window.__stateE2eNotificationReady = false
    window.__stateE2ePushNotification = () => {}

    class FakeWebSocket extends EventTarget {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3

      constructor(url) {
        super()
        this.url = url
        this.readyState = FakeWebSocket.CONNECTING
        setTimeout(() => {
          this.readyState = FakeWebSocket.OPEN
          this.dispatch('open', {})
        }, 0)
      }

      dispatch(type, event) {
        const payload =
          type === 'message'
            ? new MessageEvent('message', { data: event.data })
            : new Event(type)
        this.dispatchEvent(payload)
        this[`on${type}`]?.(payload)
      }

      send(frame) {
        const text = String(frame)
        if (text.startsWith('CONNECT') || text.startsWith('STOMP')) {
          setTimeout(() => {
            this.dispatch('message', {
              data: 'CONNECTED\nversion:1.2\n\n\u0000',
            })
          }, 10)
        }
        if (text.startsWith('SUBSCRIBE') && text.includes('/user/queue/notificaciones')) {
          const subscriptionId = /^id:(.+)$/m.exec(text)?.[1] ?? 'sub-0'
          window.__stateE2eNotificationReady = true
          window.__stateE2ePushNotification = () => {
            if (this.readyState !== FakeWebSocket.OPEN) return
            this.dispatch('message', {
              data:
                `MESSAGE\ndestination:/user/queue/notificaciones\nsubscription:${subscriptionId}\nmessage-id:state-e2e-1\ncontent-type:application/json\n\n` +
                JSON.stringify({
                  id: 321,
                  tipo: 'SISTEMA',
                  titulo: 'Aviso E2E',
                  mensaje: 'Nueva notificacion e2e',
                  leida: false,
                }) +
                '\u0000',
            })
          }
        }
      }

      close() {
        this.readyState = FakeWebSocket.CLOSED
        this.dispatch('close', {})
      }
    }

    window.WebSocket = FakeWebSocket
  })
}

async function mockQuietPersonajeDetail(page) {
  await page.route('https://api.jikan.moe/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
  await page.route('**/api/personajes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
  await page.route('**/api/personajes/luffy/imagenes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
  await page.route('**/api/personajes/luffy/similares**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
  await page.route('**/api/personajes/luffy/duelos-recientes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
  await page.route('**/api/personajes/luffy/matchups', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
  await page.route('**/api/personajes/luffy/comentarios**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [], totalElements: 0 }),
    })
  })
  await page.route('**/api/personajes/luffy/votos-periodo**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
  await page.route('**/api/personajes/luffy/elo-history**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
}

test('VerifyPage consume el token una sola vez al montar', async ({ page }) => {
  let verifyCalls = 0
  await prepareBasePage(page)
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({ status: 204 })
  })
  await page.route('**/api/auth/verify**', async (route) => {
    verifyCalls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ verificado: true }),
    })
  })

  await page.goto('/verify?token=state-e2e-token')

  await expect(page.getByRole('heading', { name: '¡Email verificado!' })).toBeVisible()
  await expect.poll(() => verifyCalls).toBe(1)
})

test('el badge de notificaciones sube por push sin abrir el dropdown', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'La campana visible vive en el header desktop; el flujo WS se cubre una vez para no duplicar carga.',
  )

  let unreadRequests = 0
  await installFakeNotificationSocket(page)
  await prepareAuthedPage(page)
  await page.route('**/api/notificaciones/unread-count', async (route) => {
    unreadRequests += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: unreadRequests >= 2 ? 1 : 0 }),
    })
  })

  await page.goto('/')

  const bell = page.locator('button[aria-label="Notificaciones"]').first()
  await expect(bell).toBeVisible()
  await expect.poll(() => unreadRequests).toBeGreaterThanOrEqual(1)
  await page.waitForFunction(() => window.__stateE2eNotificationReady === true)
  await expect(bell.locator('span')).toHaveCount(0)

  await page.evaluate(() => window.__stateE2ePushNotification())

  await expect(bell.locator('span')).toHaveText('1', { timeout: 10_000 })
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('seguir personaje hace optimistic update y rollback si falla', async ({ page }) => {
  await prepareAuthedPage(page)
  await mockQuietPersonajeDetail(page)
  let releaseFailedFollow
  const failedFollowReady = new Promise((resolve) => {
    releaseFailedFollow = resolve
  })
  await page.route('**/api/personajes/luffy/favorito', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ following: false }),
      })
      return
    }
    if (method === 'POST') {
      await failedFollowReady
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'forced rollback' }),
      })
      return
    }
    await route.fulfill({ status: 204 })
  })

  await page.goto('/personajes/luffy')

  const follow = page.getByRole('button', { name: 'Seguir a Luffy' })
  await expect(follow).toHaveAttribute('aria-pressed', 'false')
  await expect(follow).toBeEnabled()
  await follow.click()
  await expect(page.getByRole('button', { name: 'Dejar de seguir a Luffy' })).toHaveAttribute('aria-pressed', 'true')
  releaseFailedFollow()
  await expect(page.getByRole('button', { name: 'Seguir a Luffy' })).toHaveAttribute('aria-pressed', 'false', { timeout: 10_000 })
})

test('MiTop5 aplica add=slug aunque la pagina ya este montada', async ({ page }) => {
  await prepareBasePage(page)
  await page.goto('/mi-top5')

  await page.evaluate(() => {
    window.history.pushState({}, '', '/mi-top5?add=luffy')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  await expect(page.getByRole('button', { name: 'Quitar Luffy del top' })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw)[0] : null
      }, TOP5_STORAGE_KEY),
    )
    .toBe('luffy')
  await expect(page).toHaveURL(/\/mi-top5\?add=luffy$/)
})
