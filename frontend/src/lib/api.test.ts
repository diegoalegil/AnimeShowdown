import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getToken,
  setToken,
  onTokenChange,
  setLoggingOut,
  bumpSessionEpoch,
  refreshSession,
  ApiError,
  createRequestSignal,
  api,
  endpoints,
} from './api'

// ─── Reset module state before each test ───────────────────────────────────────
// api.ts has module-level mutable state:
//   - tokenEnMemoria, refreshPromise, isLoggingOut, sessionEpoch
//   - tokenChangeListeners (Set)
// Reset via exported control functions.
// vi.useFakeTimers / vi.useRealTimers manage async timer advancement.

beforeEach(() => {
  setToken(null)
  setLoggingOut(false)
  bumpSessionEpoch()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── Mock helper ────────────────────────────────────────────────────────────────

function mockResponse(
  status: number,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  const text = body === undefined ? '' : JSON.stringify(body)
  const headers: Record<string, string> = { 'content-type': 'application/json', ...extraHeaders }
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    // @ts-ignore Headers generic signature differs by TS DOM lib version
    headers: new Map(Object.entries(headers)),
    text: async () => text,
    json: async () => {
      if (!text) throw new Error('no JSON body')
      return body
    },
  } as unknown as Response
}

// Mock fetch type that includes vitest's .mock property.
// globalThis.fetch type does not expose .mock (only the actual fetch fn),
// so we augment the type locally.
type MockFetch = {
  (...args: Parameters<typeof globalThis.fetch>): ReturnType<typeof globalThis.fetch>
  mock: {
    calls: Array<[string | URL | Request, RequestInit?]>
    results: Array<{ isThrow: boolean; value: unknown }>
    instances: unknown[]
  }
}

// mockFetchResolved — resolves to the given Response on EVERY call.
// mockFetchRejected — always rejects with the given error.
// mockFetchFactory — factory function invoked on each fetch call.
//   Used for multi-call sequences (e.g. auto-refresh: 401 -> refresh ok -> retry).
// In happy-dom, vi.stubGlobal completely replaces global.fetch per test.

function mockFetchResolved(body: unknown, status = 200): MockFetch {
  return vi.fn().mockResolvedValue(mockResponse(status, body)) as unknown as MockFetch
}

function mockFetchRejected(err: Error): MockFetch {
  return vi.fn().mockRejectedValue(err) as unknown as MockFetch
}

function mockFetchFactory(factory: () => Promise<Response>): MockFetch {
  return vi.fn().mockImplementation(factory) as unknown as MockFetch
}

// ─── ApiError ───────────────────────────────────────────────────────────────────

describe('ApiError', () => {
  it('stores status and body', () => {
    const err = new ApiError('Bad request', 400, { message: 'invalid' })
    expect(err.message).toBe('Bad request')
    expect(err.status).toBe(400)
    expect(err.body).toEqual({ message: 'invalid' })
  })

  it('has name ApiError', () => {
    const err = new ApiError('Oops', 500, null)
    expect(err.name).toBe('ApiError')
  })

  it('is an instance of Error', () => {
    const err = new ApiError('Test', 404, null)
    expect(err).toBeInstanceOf(Error)
  })
})

// ─── createRequestSignal ───────────────────────────────────────────────────────

describe('createRequestSignal', () => {
  it('returns noop when no signal and no timeout', () => {
    const state = createRequestSignal({})
    expect(state.signal).toBeUndefined()
    expect(state.timedOut()).toBe(false)
    expect(() => state.cleanup()).not.toThrow()
  })

  it('returns AbortController signal when timeout > 0', () => {
    const state = createRequestSignal({ timeoutMs: 5000 })
    expect(state.signal).toBeDefined()
    expect(state.signal).toBeInstanceOf(AbortSignal)
  })

  it('marks timedOut after timeout fires', () => {
    const state = createRequestSignal({ timeoutMs: 100 })
    vi.advanceTimersByTime(200)
    expect(state.timedOut()).toBe(true)
    expect(state.signal?.aborted).toBe(true)
  })

  it('signals abort when source signal already aborted', () => {
    const src = new AbortController()
    src.abort()
    const state = createRequestSignal({ signal: src.signal })
    expect(state.signal?.aborted).toBe(true)
  })

  it('signals abort when source signal aborts mid-flight', () => {
    const src = new AbortController()
    const state = createRequestSignal({ signal: src.signal, timeoutMs: 99_999 })
    src.abort('cancelled by user')
    expect(state.signal?.aborted).toBe(true)
  })

  it('cleanup clears timeout timer', () => {
    const state = createRequestSignal({ timeoutMs: 10_000 })
    state.cleanup()
    vi.advanceTimersByTime(20_000)
    expect(state.timedOut()).toBe(false)
    expect(state.signal?.aborted).toBe(false)
  })
})

// ─── Token management ─────────────────────────────────────────────────────────

describe('getToken / setToken', () => {
  it('returns null initially', () => {
    expect(getToken()).toBeNull()
  })

  it('returns the token set via setToken', () => {
    setToken('jwt.abc.123')
    expect(getToken()).toBe('jwt.abc.123')
    setToken(null)
  })

  it('treats undefined as null', () => {
    setToken('jwt.old')
    setToken(undefined)
    expect(getToken()).toBeNull()
  })
})

describe('onTokenChange', () => {
  it('calls listener on token change (null -> token)', () => {
    const cb = vi.fn()
    onTokenChange(cb)
    setToken('jwt.new')
    expect(cb).toHaveBeenCalledWith('jwt.new')
    setToken(null)
  })

  it('calls listener when token cleared (token -> null)', () => {
    const cb = vi.fn()
    onTokenChange(cb)
    setToken('jwt.x')
    cb.mockClear()
    setToken(null)
    expect(cb).toHaveBeenCalledWith(null)
  })

  it('deregister returns true and removes listener', () => {
    const cb = vi.fn()
    const deregister = onTokenChange(cb)
    expect(deregister()).toBe(true)
    expect(deregister()).toBe(false)
    setToken('jwt.y')
    expect(cb).not.toHaveBeenCalled()
  })

  it('listener error does not propagate', () => {
    const cb = vi.fn().mockImplementation(() => { throw new Error('oops') })
    onTokenChange(cb)
    expect(() => setToken('jwt.z')).not.toThrow()
    setToken(null)
  })
})

// ─── setLoggingOut ──────────────────────────────────────────────────────────────

describe('setLoggingOut', () => {
  it('makes refreshSession return null immediately', async () => {
    setLoggingOut(true)
    expect(await refreshSession()).toBeNull()
    setLoggingOut(false)
  })
})

// ─── refreshSession ──────────────────────────────────────────────────────────────

describe('refreshSession', () => {
  it('returns null on isLoggingOut', async () => {
    setLoggingOut(true)
    expect(await refreshSession()).toBeNull()
    setLoggingOut(false)
  })

  it('returns null on fetch failure', async () => {
    vi.stubGlobal('fetch', mockFetchResolved(null, 500))
    expect(await refreshSession()).toBeNull()
    expect(getToken()).toBeNull()
  })

  it('returns null on 401', async () => {
    setToken('jwt.old')
    vi.stubGlobal('fetch', mockFetchResolved(null, 401))
    expect(await refreshSession()).toBeNull()
    expect(getToken()).toBeNull()
  })

  it('returns null on 204 No Content', async () => {
    vi.stubGlobal('fetch', mockFetchResolved(null, 204))
    expect(await refreshSession()).toBeNull()
  })

  it('sets token and returns payload on success)', async () => {
    const tok = 'jwt.fresh'
    vi.stubGlobal('fetch', mockFetchResolved({ token: tok, usuario: { id: 1 } }))
    const result = await refreshSession()
    expect(result).toEqual({ token: tok, usuario: { id: 1 } })
    expect(getToken()).toBe(tok)
    setToken(null)
  })

  it('dispatches token change on success', async () => {
    const cb = vi.fn()
    onTokenChange(cb)
    vi.stubGlobal('fetch', mockFetchResolved({ token: 'jwt.cb' }))
    await refreshSession()
    expect(cb).toHaveBeenCalledWith('jwt.cb')
    setToken(null)
  })

  it('ignores payload without token field', async () => {
    vi.stubGlobal('fetch', mockFetchResolved({ usuario: { id: 2 } }))
    const prev = getToken()
    const result = await refreshSession()
    expect(result).toEqual({ usuario: { id: 2 } })
    expect(getToken()).toBe(prev)
  })

  it('retries once on 503 with Retry-After header then succeeds', async () => {
    let idx = 0
    vi.stubGlobal('fetch', mockFetchFactory(async () => {
      idx++
      if (idx === 1) return mockResponse(503, null, { 'retry-after': '1' })
      return mockResponse(200, { token: 'jwt.retry' })
    }))
    const promise = refreshSession()
    await vi.advanceTimersByTimeAsync(400)
    expect(await promise).toEqual({ token: 'jwt.retry' })
    setToken(null)
  })

  it('gives up after GRACE_MAX_RETRIES on persistent 503', async () => {
    vi.stubGlobal('fetch', mockFetchResolved(null, 503))
    const promise = refreshSession()
    await vi.advanceTimersByTimeAsync(3000)
    expect(await promise).toBeNull()
  })
})

// ─── api client ─────────────────────────────────────────────────────────────────

describe('api.get / api.post / api.put / api.del', () => {
  it('get uses GET method', async () => {
    const fn = mockFetchResolved({ data: 1 })
    vi.stubGlobal('fetch', fn)
    await api.get('/api/personajes')
    expect((fn.mock.calls[0] as [string, RequestInit])[1].method).toBe('GET')
  })

  it('post uses POST and JSON body', async () => {
    const fn = mockFetchResolved({ id: 1 }, 201)
    vi.stubGlobal('fetch', fn)
    await api.post('/api/personajes', { nombre: 'Luffy' })
    const [, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe('{"nombre":"Luffy"}')
    expect(opts.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('put uses PUT', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await api.put('/api/personajes/1', { nombre: 'Zoro' })
    expect((fn.mock.calls[0] as [string, RequestInit])[1].method).toBe('PUT')
  })

  it('del uses DELETE', async () => {
    const fn = mockFetchResolved(null, 204)
    vi.stubGlobal('fetch', fn)
    await api.del('/api/personajes/1')
    expect((fn.mock.calls[0] as [string, RequestInit])[1].method).toBe('DELETE')
  })

  it('sets Authorization Bearer when auth=true and token set', async () => {
    setToken('jwt.auth Bearer')
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await api.get('/api/perfil/me/stats')
    const headers = (fn.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>
    expect(headers?.Authorization).toBe('Bearer jwt.auth Bearer')
    setToken(null)
  })

  it('omits Authorization when auth=false', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await api.get('/api/personajes', { auth: false })
    const headers = (fn.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>
    expect(headers?.Authorization).toBeUndefined()
  })

  it('always sets credentials: include', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await api.get('/api/status')
    expect((fn.mock.calls[0] as [string, RequestInit])[1].credentials).toBe('include')
  })

  it('returns parsed JSON on 200', async () => {
    const fn = mockFetchResolved({ luffy: true })
    vi.stubGlobal('fetch', fn)
    expect(await api.get('/api/personajes')).toEqual({ luffy: true })
  })

  it('returns null on 204 No Content', async () => {
    const fn = mockFetchResolved(null, 204)
    vi.stubGlobal('fetch', fn)
    expect(await api.post('/api/auth/logout', undefined, { auth: false })).toBeNull()
  })

  it('throws ApiError on non-OK response', async () => {
    const fn = mockFetchResolved({ message: 'Nombre requerido' }, 400)
    vi.stubGlobal('fetch', fn)
    await expect(api.post('/api/personajes', {})).rejects.toThrow(ApiError)
  })

  it('ApiError.message prefers parsed message over statusText', async () => {
    const fn = mockFetchResolved({ message: 'No encontrado' }, 404)
    vi.stubGlobal('fetch', fn)
    await expect(api.get('/api/personajes/nonexistent')).rejects.toMatchObject({
      status: 404,
      message: 'No encontrado',
    })
  })

  it('falls back to statusText when body has no message field', async () => {
    const fn = mockFetchResolved(null, 500)
    vi.stubGlobal('fetch', fn)
    await expect(api.get('/api/status')).rejects.toMatchObject({ status: 500, message: '500' })
  })

  it('falls back to plain text body as ApiError message', async () => {
    const fn = mockFetchResolved('Something went wrong', 500)
    vi.stubGlobal('fetch', fn)
    await expect(api.get('/api/status')).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('Something went wrong'),
    })
  })

  it('throws ApiError status=0 on network error', async () => {
    const fn = mockFetchRejected(new Error('Network error'))
    vi.stubGlobal('fetch', fn)
    await expect(api.get('/api/status')).rejects.toMatchObject({ status: 0 })
  })

  it('spreads custom headers alongside auth', async () => {
    setToken('jwt.test')
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await api.get('/api/enfrentamientos/1/votar', {
      auth: true,
      headers: { 'X-Idempotency-Key': 'abc123' },
    })
    const headers = (fn.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>
    expect(headers?.['X-Idempotency-Key']).toBe('abc123')
    expect(headers?.Authorization).toMatch(/Bearer/)
    setToken(null)
  })

  it('auto-refreshes 401 then retries with new token', async () => {
    setToken('jwt.old')
    let idx = 0
    vi.stubGlobal('fetch', mockFetchFactory(async () => {
      idx++
      if (idx === 1) return mockResponse(401)
      if (idx === 2) return mockResponse(200, { token: 'jwt.new' })
      return mockResponse(200, { ok: true })
    }))
    expect(await api.get('/api/perfil/me/stats')).toEqual({ ok: true })
    expect(getToken()).toBe('jwt.new')
    setToken(null)
  })

  it('auto-refreshes 403 when token exists (expired JWT)', async () => {
    setToken('jwt.expired')
    let idx = 0
    vi.stubGlobal('fetch', mockFetchFactory(async () => {
      idx++
      if (idx === 1) return mockResponse(403)
      if (idx === 2) return mockResponse(200, { token: 'jwt.refreshed' })
      return mockResponse(200, { data: 'ok' })
    }))
    expect(await api.get('/api/perfil/me/stats')).toEqual({ data: 'ok' })
    setToken(null)
  })

  it('does NOT auto-refresh 403 when no token (genuine forbidden)', async () => {
    const fn = mockFetchResolved(null, 403)
    vi.stubGlobal('fetch', fn)
    await expect(api.get('/api/perfil/me/stats')).rejects.toMatchObject({ status: 403 })
    expect(fn.mock.calls.length).toBe(1)
  })

  it('does NOT auto-refresh on auth routes', async () => {
    setToken('jwt.old')
    const fn = mockFetchResolved(null, 401)
    vi.stubGlobal('fetch', fn)
    await expect(api.post('/api/auth/login', {})).rejects.toMatchObject({ status: 401 })
    expect(fn.mock.calls.length).toBe(1)
    setToken(null)
  })
})

// ─── endpoints ───────────────────────────────────────────────────────────────────────

describe('endpoints', () => {
  it('login: POST /api/auth/login without auth', async () => {
    const fn = mockFetchResolved({ token: 't' })
    vi.stubGlobal('fetch', fn)
    await endpoints.login({ username: 'goku', password: 'pass' })
    expect((fn.mock.calls[0] as [string, RequestInit])[1].method).toBe('POST')
  })

  it('votar: sends personajeGanadorId in body', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.votar('enc-1', 42)
    const body = (fn.mock.calls[0] as [string, RequestInit])[1].body
    expect(JSON.parse(body as string)).toEqual({ personajeGanadorId: 42 })
  })

  it('votar: envia empate neutral sin personajeGanadorId', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.votar('enc-empate', null, { empate: true })
    const body = (fn.mock.calls[0] as [string, RequestInit])[1].body
    expect(JSON.parse(body as string)).toEqual({ empate: true })
  })

  it('votar: anonymous=true sets auth=false', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.votar('enc-2', 7, { anonymous: true })
    const headers = (fn.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>
    expect(headers?.Authorization).toBeUndefined()
  })

  it('votar: passes idempotency headers through', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.votar('enc-3', 3, { headers: { 'X-Idempotency-Key': 'xyz' } })
    const headers = (fn.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>
    expect(headers?.['X-Idempotency-Key']).toBe('xyz')
  })

  it('rankingMovimientos: constructs query params limit+dias', async () => {
    const fn = mockFetchResolved([])
    vi.stubGlobal('fetch', fn)
    await endpoints.rankingMovimientos({ limit: 20, dias: 30 })
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('limit=20')
    expect(url).toContain('dias=30')
  })

  it('rankingSegmentado: includes optional anime param', async () => {
    const fn = mockFetchResolved([])
    vi.stubGlobal('fetch', fn)
    await endpoints.rankingSegmentado({ periodo: 'mes', anime: 'One Piece' })
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('periodo=mes')
    expect(url).toContain('anime=One+Piece')
  })

  it('votosPeriodoBatch: resolves [] immediately when slugs empty', async () => {
    const result = await endpoints.votosPeriodoBatch({ slugs: [] })
    expect(result).toEqual([])
  })

  it('votosPeriodoBatch: calls fetch for non-empty slugs array', async () => {
    const fn = mockFetchResolved([])
    vi.stubGlobal('fetch', fn)
    const slugs = ['a', 'b', 'c']
    await endpoints.votosPeriodoBatch({ slugs })
    expect(fn.mock.calls.length).toBeGreaterThan(0)
  })

  it('adminComentarios: uses URLSearchParams correctly', async () => {
    const fn = mockFetchResolved([])
    vi.stubGlobal('fetch', fn)
    await endpoints.adminComentarios({ estado: 'APROBADO', page: 2, size: 50 })
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('estado=APROBADO')
    expect(url).toContain('page=2')
    expect(url).toContain('size=50')
  })

  it('personajesEloHistoryBatch: joins slugs with commas', async () => {
    const fn = mockFetchResolved([])
    vi.stubGlobal('fetch', fn)
    await endpoints.personajesEloHistoryBatch(['luffy', 'zoro', 'nami'])
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('slugs=luffy,zoro,nami')
  })

  it('iniciarTorneo: sends optional participantesIds body', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.iniciarTorneo(1, [101, 102, 103, 104])
    const body = (fn.mock.calls[0] as [string, RequestInit])[1].body
    expect(JSON.parse(body as string)).toEqual({ participantesIds: [101, 102, 103, 104] })
  })

  it('iniciarTorneo: no body when participants omitted', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.iniciarTorneo(1)
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('torneos/1/iniciar')
    expect((fn.mock.calls[0] as [string, RequestInit])[1].body).toBeUndefined()
  })

  it('torneoBySlug: GET /api/torneos/slug/{slug}', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.torneoBySlug('grand-prize')
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('/torneos/slug/grand-prize')
  })

  it('tierListCreate: POST a /api/tier-lists', async () => {
    const fn = mockFetchResolved({ id: 1 })
    vi.stubGlobal('fetch', fn)
    await endpoints.tierListCreate({ titulo: 'Naruto', publico: false, items: [] })
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/tier-lists')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body as string)).toEqual({ titulo: 'Naruto', publico: false, items: [] })
  })

  it('tierListUpdate: PUT con id', async () => {
    const fn = mockFetchResolved({ id: 7 })
    vi.stubGlobal('fetch', fn)
    await endpoints.tierListUpdate(7, { titulo: 'Actualizada', items: [] })
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/tier-lists/7')
    expect(opts.method).toBe('PUT')
  })

  it('tierListPublic: GET público por slug', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.tierListPublic('best-naruto')
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/tier-lists/public/best-naruto')
    expect(opts.method).toBe('GET')
    expect((opts.headers as Record<string, string>)?.Authorization).toBeUndefined()
  })

  it('aplicarPrediccionCampeon: sends tournament champion prediction', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.aplicarPrediccionCampeon({ torneoId: 7, personajePredichoId: 42 })
    const [url, init] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/predicciones/campeon')
    expect(JSON.parse(init.body as string)).toEqual({
      torneoId: 7,
      personajePredichoId: 42,
    })
  })

  it('leaderboardPrediccionesTorneo: GET public tournament leaderboard', async () => {
    const fn = mockFetchResolved([])
    vi.stubGlobal('fetch', fn)
    await endpoints.leaderboardPrediccionesTorneo({ torneoId: 7, limit: 5 })
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('/predicciones/leaderboard/torneo/7?limit=5')
  })

  it('rankingSegmentado: defaults periodo=all with no anime', async () => {
    const fn = mockFetchResolved([])
    vi.stubGlobal('fetch', fn)
    await endpoints.rankingSegmentado({})
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('periodo=all')
    expect(url).not.toContain('anime=')
  })

  it('desbloquearOtakuCertificado: POST with no body', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.desbloquearOtakuCertificado()
    expect((fn.mock.calls[0] as [string, RequestInit])[1].method).toBe('POST')
  })

  it('abrirSobre: pasa X-Idempotency-Key cuando existe', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.abrirSobre('pack-abc')
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    const headers = opts.headers as Record<string, string>
    expect(url).toContain('/api/me/cartas/sobre')
    expect(opts.method).toBe('POST')
    expect(headers?.['X-Idempotency-Key']).toBe('pack-abc')
  })

  it('cofreDiario: POST a /api/me/cartas/cofre-diario', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.cofreDiario()
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/me/cartas/cofre-diario')
    expect(opts.method).toBe('POST')
  })

  it('unsubscribeNewsletter: POST with token in query', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.unsubscribeNewsletter('tokenXYZ')
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('token=tokenXYZ')
    expect(url).toContain('/newsletter/unsubscribe')
  })

  it('pushSubscribe: POST subscription payload', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.pushSubscribe({
      endpoint: 'https://push.example/sub/1',
      keys: { p256dh: 'key-a', auth: 'auth-a' },
    })
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/me/push/subscribe')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body as string)).toEqual({
      endpoint: 'https://push.example/sub/1',
      keys: { p256dh: 'key-a', auth: 'auth-a' },
    })
  })

  it('pushUnsubscribe: DELETE endpoint payload', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.pushUnsubscribe('https://push.example/sub/1')
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/me/push/unsubscribe')
    expect(opts.method).toBe('DELETE')
    expect(JSON.parse(opts.body as string)).toEqual({
      endpoint: 'https://push.example/sub/1',
    })
  })

  // ─── Intención de voto (feature #15) ─────────────────────────────────────
  it('votar: incluye categoria en el body cuando se pasa', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.votar('enc-9', 5, { categoria: 'poder' })
    const body = (fn.mock.calls[0] as [string, RequestInit])[1].body
    expect(JSON.parse(body as string)).toEqual({ personajeGanadorId: 5, categoria: 'poder' })
  })

  it('votar: omite categoria del body cuando no se elige', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.votar('enc-10', 5)
    const body = (fn.mock.calls[0] as [string, RequestInit])[1].body
    expect(JSON.parse(body as string)).toEqual({ personajeGanadorId: 5 })
  })

  it('rankingSegmentado: incluye el param categoria', async () => {
    const fn = mockFetchResolved([])
    vi.stubGlobal('fetch', fn)
    await endpoints.rankingSegmentado({ periodo: 'mes', categoria: 'mejor-villano' })
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('periodo=mes')
    expect(url).toContain('categoria=mejor-villano')
  })

  it('setCategoriaVoto: PATCH a /votar/categoria con la categoria en el body', async () => {
    const fn = mockFetchResolved(null, 204)
    vi.stubGlobal('fetch', fn)
    await endpoints.setCategoriaVoto('enc-11', 'carisma')
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/enfrentamientos/enc-11/votar/categoria')
    expect(opts.method).toBe('PATCH')
    expect(JSON.parse(opts.body as string)).toEqual({ categoria: 'carisma' })
  })

  it('setCategoriaVoto: anonymous=true no manda Authorization', async () => {
    const fn = mockFetchResolved(null, 204)
    vi.stubGlobal('fetch', fn)
    await endpoints.setCategoriaVoto('enc-12', 'favorito', { anonymous: true })
    const headers = (fn.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>
    expect(headers?.Authorization).toBeUndefined()
  })

  it('categoriasConVotos: GET a /ranking/categorias-disponibles', async () => {
    const fn = mockFetchResolved([])
    vi.stubGlobal('fetch', fn)
    await endpoints.categoriasConVotos()
    const url = (fn.mock.calls[0] as [string, RequestInit])[0]
    expect(url).toContain('/api/votos/ranking/categorias-disponibles')
  })

  it('fantasyGuardarEquipo: manda los cinco personajes al draft', async () => {
    const fn = mockFetchResolved({})
    vi.stubGlobal('fetch', fn)
    await endpoints.fantasyGuardarEquipo([1, 2, 3, 4, 5])
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/fantasy/me/equipo')
    expect(opts.method).toBe('PUT')
    expect(JSON.parse(opts.body as string)).toEqual({ personajeIds: [1, 2, 3, 4, 5] })
  })

  it('fantasyLeaderboard: usa lectura pública con semana opcional', async () => {
    const fn = mockFetchResolved([])
    vi.stubGlobal('fetch', fn)
    await endpoints.fantasyLeaderboard({ semanaIso: '2026-W22', limit: 20 })
    const [url, opts] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/fantasy/leaderboard?')
    expect(url).toContain('semanaIso=2026-W22')
    expect(url).toContain('limit=20')
    expect((opts.headers as Record<string, string>)?.Authorization).toBeUndefined()
  })
})
