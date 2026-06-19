const DEV_API_BASE = 'http://localhost:8080'
const PROD_API_BASE = 'https://api.animeshowdown.dev'

type TokenChangeListener = (token: string | null) => void

type ApiErrorBody = unknown

type RequestSignalOptions = {
  signal?: AbortSignal
  timeoutMs?: number
}

type RequestSignalState = {
  signal?: AbortSignal
  timedOut: () => boolean
  cleanup: () => void
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestOptions = {
  method?: HttpMethod
  body?: unknown
  auth?: boolean
  timeoutMs?: number
  signal?: AbortSignal
  headers?: Record<string, string>
}

type FetchExecutionOptions = {
  method: HttpMethod
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
  includeAuth?: boolean
}

type RefreshPayload = {
  token?: string
  usuario?: unknown
  [key: string]: unknown
} | null

type ApiClient = {
  base: string
  // Devuelven `any` (no `unknown`) a propósito: los ~130 consumidores de
  // `endpoints` acceden a campos de la respuesta sin narrowing. Tiparlos por
  // endpoint (desde los DTOs del backend) es el follow-up; por ahora esto
  // mantiene la ergonomía actual mientras `satisfies EndpointMap` añade el
  // chequeo de existencia de claves (lo que habría cazado el bug `changeBio`).
  get: (path: string, opts?: RequestOptions) => Promise<any>
  post: (path: string, body?: unknown, opts?: RequestOptions) => Promise<any>
  put: (path: string, body?: unknown, opts?: RequestOptions) => Promise<any>
  patch: (path: string, body?: unknown, opts?: RequestOptions) => Promise<any>
  del: (path: string, opts?: RequestOptions) => Promise<any>
}

type EndpointMap = Record<string, (...args: any[]) => any>
type BlobResult = {
  blob: Blob
  filename?: string
}

function normalizarApiBase(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    if (import.meta.env.DEV) return DEV_API_BASE
    return PROD_API_BASE
  }
  try {
    const url = new URL(raw)
    if (import.meta.env.PROD && /\.up\.railway\.app$/i.test(url.hostname)) {
      console.warn('[api] La URL del API apunta a Railway; usa el dominio canónico del API en producción.')
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    if (import.meta.env.DEV) return DEV_API_BASE
    throw new Error('VITE_API_BASE_URL debe ser una URL válida')
  }
}

// VITE_API_BASE_URL es el nombre canónico (ver .env.example); VITE_API_URL se
// mantiene como alias legacy aceptado para no romper despliegues existentes
// (CI/Cloudflare aún pasan VITE_API_URL). El primero tiene precedencia.
export const API_BASE = normalizarApiBase(
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL,
)

// El JWT vive en memoria, no en localStorage. La sesión
// persistente la da el refresh_token cookie httpOnly que pone el backend
// — esa cookie no la pueden tocar scripts (defensa XSS) y solo viaja a
// nuestro propio dominio en peticiones credentialed (defensa CSRF).
//
// Bootstrap: al abrir la app, AuthContext llama refreshSession() para
// intentar conseguir un JWT fresco usando la cookie persistente. Si éxito
// el usuario sigue logueado; si fallo aparece como invitado.
let tokenEnMemoria: string | null = null

// AuthContext marca esto a true cuando hay una sesión ESPERADA (usuario
// optimista restaurado de localStorage o tras login), y a false cuando se
// confirma invitado (bootstrap sin sesión / logout). Permite que, en carga
// fría, una petición autenticada SIN token todavía espere al /refresh del
// bootstrap antes de disparar — sin refrescar para usuarios genuinamente
// anónimos (donde un 403 es "forbidden" real, no "token aún no hidratado").
let sesionEsperada = false

export function setSesionEsperada(esperada: boolean): void {
  sesionEsperada = Boolean(esperada)
}

export function getToken(): string | null {
  return tokenEnMemoria
}

// Listeners para "token cambió". Permite a stomp.js
// reconectar con JWT nuevo tras refresh silencioso (auto-refresh tras 401).
// Sin esto, el WS singleton seguía con el JWT viejo hasta logout/reload.
const tokenChangeListeners = new Set<TokenChangeListener>()
export function onTokenChange(cb: TokenChangeListener): () => boolean {
  tokenChangeListeners.add(cb)
  return () => tokenChangeListeners.delete(cb)
}
function notifyTokenChange(): void {
  for (const cb of tokenChangeListeners) {
    try { cb(tokenEnMemoria) } catch { /* listener errors aren't ours */ }
  }
}

export function setToken(token: string | null | undefined): void {
  const prev = tokenEnMemoria
  tokenEnMemoria = token || null
  if (prev !== tokenEnMemoria) notifyTokenChange()
}

export class ApiError extends Error {
  status: number
  body: ApiErrorBody

  constructor(message: string, status: number, body: ApiErrorBody) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

// Timeout por defecto para todas las requests al backend. Antes el fetch no
// tenía timeout y se podía quedar colgado indefinidamente en redes lentas o si
// el backend tardaba en responder, dejando spinners eternos en el frontend.
// 20s (no 10s): el backend (Railway) puede tardar en responder la PRIMERA
// request tras un periodo idle (cold-start del JVM); 10s cancelaba esa primera
// carga (p.ej. /torneos, /animes) con "la petición tardó demasiado". 20s da
// margen al warm-up sin colgar indefinidamente ante fallos reales.
const DEFAULT_TIMEOUT_MS = 20000

export function createRequestSignal({
  signal,
  timeoutMs,
}: RequestSignalOptions = {}): RequestSignalState {
  const timeout = timeoutMs ?? 0
  const hasTimeout = Number.isFinite(timeout) && timeout > 0
  if (!signal && !hasTimeout) {
    return {
      signal: undefined,
      timedOut: () => false,
      cleanup: () => {},
    }
  }

  const controller = new AbortController()
  const cleanupFns: Array<() => void> = []
  let didTimeout = false

  const abortFrom = (sourceSignal?: AbortSignal) => {
    if (controller.signal.aborted) return
    try {
      controller.abort(sourceSignal?.reason)
    } catch {
      controller.abort()
    }
  }

  if (signal) {
    if (signal.aborted) {
      abortFrom(signal)
    } else {
      const onAbort = () => abortFrom(signal)
      signal.addEventListener('abort', onAbort, { once: true })
      cleanupFns.push(() => signal.removeEventListener('abort', onAbort))
    }
  }

  if (hasTimeout) {
    const timeoutId = setTimeout(() => {
      didTimeout = true
      abortFrom()
    }, timeout)
    cleanupFns.push(() => clearTimeout(timeoutId))
  }

  return {
    signal: controller.signal,
    timedOut: () => didTimeout,
    cleanup: () => {
      cleanupFns.forEach((fn) => fn())
    },
  }
}

// Promesa singleton para deduplicar refresh paralelos. Si dos peticiones
// reciben 401 a la vez, ambas comparten el mismo intento de refresh —
// evitamos cosas raras como "rotar el refresh dos veces" que invalidaría
// la sesión por reuse-detection del backend.
let refreshPromise: Promise<RefreshPayload> | null = null

// Flag que bloquea intentarRefresh durante
// el logout. Si una request paralela recibe 401 y dispara refresh DESPUÉS
// de que el user haya pulsado logout pero ANTES de que el backend revoque
// el refresh, el refresh "exitoso" emite una cookie nueva y resucita la
// sesión que el user acababa de cerrar. Al activar el flag, cualquier
// intentarRefresh devuelve null inmediato y la request queda 401-final.
let isLoggingOut = false
export function setLoggingOut(value: unknown): void {
  isLoggingOut = Boolean(value)
}

// Epoch de sesión. setLoggingOut(true)
// cortaba refreshes NUEVOS, pero un refreshPromise YA en vuelo que
// resolviera después seguía aplicando setToken → resucitaba la sesión.
// Cada cambio de sesión (logout, login, refresh exitoso) incrementa el
// epoch; cuando intentarRefresh resuelve, comprueba que el epoch sigue
// siendo el suyo antes de propagar tokenEnMemoria / notify. Si cambió
// (otro flow ya pasó por ahí), descarta el resultado silenciosamente.
let sessionEpoch = 0
export function bumpSessionEpoch(): void {
  sessionEpoch++
}

/**
 * Grace cross-tab robusto.
 * El backend devuelve 503 + Retry-After cuando otra pestaña acaba de
 * rotar el refresh. El cliente respeta Retry-After (segundos) y hace
 * hasta GRACE_MAX_RETRIES intentos antes de considerar muerta la
 * sesión. Solo limpiamos tokenEnMemoria ante 401 explícito o cuando
 * agotamos retries — antes un único retry de 350ms podía perderse si
 * el navegador aún no había aplicado la cookie nueva al dominio.
 */
const GRACE_MAX_RETRIES = 3
const GRACE_MIN_DELAY_MS = 300

function parseRetryAfterMs(headerValue: string | null, fallbackMs: number): number {
  if (!headerValue) return fallbackMs
  // Retry-After estándar HTTP: segundos enteros (o fecha HTTP-date).
  const seconds = parseInt(headerValue, 10)
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.max(GRACE_MIN_DELAY_MS, seconds * 1000)
  }
  return fallbackMs
}

// Timeout específico del /refresh — más corto que el default (10s) porque
// es bloqueante para bootstrap y para reintentos automáticos. Si Railway
// está saturado, fail-fast en 6s evita spinners eternos.
const REFRESH_TIMEOUT_MS = 6000

async function intentarRefresh(): Promise<RefreshPayload> {
  if (isLoggingOut) return null
  if (refreshPromise) return refreshPromise
  // Captura el epoch al iniciar. Si cambia mientras la promesa está en
  // vuelo (logout, login en otra tab, etc.), no aplicamos el resultado.
  const myEpoch = sessionEpoch
  refreshPromise = (async () => {
    // AbortController por intento para
    // que /refresh tenga timeout propio. Antes el cliente global tenía
    // timeout pero intentarRefresh hacía fetch directo sin abort, así
    // que bootstrap y 401-retries quedaban colgados.
    const doFetch = async (): Promise<Response> => {
      const ctl = new AbortController()
      const tid = setTimeout(() => ctl.abort(), REFRESH_TIMEOUT_MS)
      try {
        return await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: ctl.signal,
        })
      } finally {
        clearTimeout(tid)
      }
    }
    try {
      let res = await doFetch()
      // Loop de retries solo para 503 grace. 401 / otros 5xx caen
      // directo a la rama de sesión muerta.
      for (let attempt = 0; attempt < GRACE_MAX_RETRIES && res.status === 503; attempt++) {
        const retryAfterMs = parseRetryAfterMs(
          res.headers.get('Retry-After'),
          GRACE_MIN_DELAY_MS + attempt * 400, // backoff: 300, 700, 1100
        )
        await new Promise((r) => setTimeout(r, retryAfterMs))
        res = await doFetch()
      }
      // Si entre fetch y resolve cambió la sesión (logout, otro refresh),
      // descartamos el resultado sin tocar tokenEnMemoria — no resucitamos
      // sesión cerrada ni pisamos sesión nueva.
      if (myEpoch !== sessionEpoch) return null
      if (!res.ok) {
        const prev = tokenEnMemoria
        tokenEnMemoria = null
        if (prev !== null) notifyTokenChange()
        return null
      }
      // 204 No Content: el backend señala "no había cookie de refresh"
      // sin disparar el console.error del 401.
      // No hay body que parsear, tratamos como sesión vacía.
      if (res.status === 204) {
        const prev = tokenEnMemoria
        tokenEnMemoria = null
        if (prev !== null) notifyTokenChange()
        return null
      }
      const data = await res.json() as RefreshPayload
      if (data?.token) {
        const prev = tokenEnMemoria
        tokenEnMemoria = data.token
        if (prev !== tokenEnMemoria) notifyTokenChange()
      }
      return data
    } catch {
      if (myEpoch !== sessionEpoch) return null
      const prev = tokenEnMemoria
      tokenEnMemoria = null
      if (prev !== null) notifyTokenChange()
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

/**
 * Llamada pública para que AuthContext intente recuperar sesión al montar.
 * Devuelve { token, usuario } si éxito, null si la cookie no es válida.
 */
export async function refreshSession(): Promise<RefreshPayload> {
  return intentarRefresh()
}

async function ejecutarFetch(
  path: string,
  {
    method,
    headers = {},
    body,
    signal,
    includeAuth,
  }: FetchExecutionOptions,
): Promise<Response> {
  // Content-Type: application/json solo cuando hay body.
  // En GET/HEAD sin body el header no aporta nada y dispara
  // preflight CORS innecesario en cross-origin (es un "non-simple header"
  // segun fetch spec) — el browser hace OPTIONS extra antes del GET real.
  const fullHeaders = { ...headers }
  if (body !== undefined) {
    fullHeaders['Content-Type'] = 'application/json'
  }
  if (includeAuth && tokenEnMemoria) {
    fullHeaders.Authorization = `Bearer ${tokenEnMemoria}`
  }
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: fullHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    // credentials: 'include' siempre — necesario para que la cookie
    // refresh_token viaje en las peticiones a /api/auth/refresh y
    // /api/auth/logout. En el resto de endpoints no estorba.
    credentials: 'include',
  })
}

async function request(
  path: string,
  {
    method = 'GET',
    body,
    auth = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    headers = {},
  }: RequestOptions = {},
): Promise<unknown> {
  // Combinamos el signal externo del caller con el timeout propio.
  // Antes pasar `signal` desactivaba el timeout y podia dejar requests
  // colgadas si el caller no abortaba manualmente.
  const requestSignal = createRequestSignal({ signal, timeoutMs })

  // Excluimos los endpoints de auth para no entrar en bucle de refresh.
  const esRutaAuth =
    path.includes('/api/auth/refresh') ||
    path.includes('/api/auth/login') ||
    path.includes('/api/auth/registro')

  let res
  try {
    // Carga fría: si es una petición autenticada y AÚN no hay token en memoria
    // (el bootstrap de /refresh puede estar en vuelo), esperamos a que el
    // refresh resuelva ANTES de disparar. Si no, en el primer paint las queries
    // /me salen sin token y el backend responde 403 (entry point FORBIDDEN),
    // que el cliente NO reintenta sin token previo → la UI se queda con datos
    // viejos (p.ej. el banner del sobre de bienvenida sigue ofreciéndose tras
    // reclamarlo). intentarRefresh está dedup-eado (refreshPromise, el MISMO
    // que usa refreshSession del bootstrap), así que todas las /me iniciales
    // comparten UN refresh; si el user es anónimo (sin cookie) falla rápido y
    // la petición sigue sin token (comportamiento previo). Solo cuando hay
    // sesión ESPERADA (sesionEsperada): un 403 sin token ni sesión esperada es
    // "forbidden" genuino (anónimo) y NO debe disparar refresh (contrato).
    if (auth && !esRutaAuth && tokenEnMemoria === null && sesionEsperada) {
      await intentarRefresh()
    }
    res = await ejecutarFetch(path, {
      method,
      body,
      headers,
      signal: requestSignal.signal,
      includeAuth: auth,
    })

    // Auto-refresh on 401/403: si la petición autenticada falla con 401 o
    // 403 con token en memoria, intenta /refresh una vez. Si el refresh
    // funciona, reintenta la petición original con el nuevo token. Si el
    // refresh falla, propaga el error original.
    //
    // SecurityConfig devuelve 403 (no 401) cuando llega una API call
    // sin auth o con JWT expirado — esto es
    // intencional para no exponer entry-point que redirige a /login en
    // /api/**. Antes, frontend solo reaccionaba a 401; tras 15 min con
    // JWT expirado, todas las llamadas autenticadas devolvian 403 sin
    // intentar refresh, y el user perdia sesion silenciosamente aunque
    // tuviera refresh_token cookie valido.
    //
    // Ahora reaccionamos a AMBOS, pero solo cuando hay tokenEnMemoria
    // (indica JWT expirado, no "user nunca logueado") — asi un 403
    // genuino "no tienes permiso para esto" no entra en bucle de refresh.
    const necesitaRefresh =
      auth &&
      !esRutaAuth &&
      (res.status === 401 ||
        (res.status === 403 && tokenEnMemoria !== null))
    if (necesitaRefresh) {
      const refreshed = await intentarRefresh()
      if (refreshed?.token) {
        res = await ejecutarFetch(path, {
          method,
          body,
          headers,
          signal: requestSignal.signal,
          includeAuth: true,
        })
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (!requestSignal.timedOut()) {
        throw new ApiError('La petición se canceló', 0, null)
      }
      throw new ApiError(
        `La petición tardó demasiado (más de ${timeoutMs}ms) y se canceló`,
        0,
        null,
      )
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Error de red al contactar con el servidor',
      0,
      null,
    )
  } finally {
    requestSignal.cleanup()
  }

  const text = await res.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  if (!res.ok) {
    const fallback =
      typeof parsed === 'string' && parsed.length > 0
        ? parsed.slice(0, 200)
        : null
    const parsedMessage =
      parsed &&
      typeof parsed === 'object' &&
      'message' in parsed &&
      typeof parsed.message === 'string'
        ? parsed.message
        : null
    throw new ApiError(
      parsedMessage || fallback || res.statusText || `Error ${res.status} del servidor`,
      res.status,
      parsed,
    )
  }
  return parsed
}

async function requestBlob(
  path: string,
  {
    method = 'GET',
    body,
    auth = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    headers = {},
  }: RequestOptions = {},
): Promise<BlobResult> {
  const requestSignal = createRequestSignal({ signal, timeoutMs })
  let res
  try {
    res = await ejecutarFetch(path, {
      method,
      body,
      headers,
      signal: requestSignal.signal,
      includeAuth: auth,
    })

    const esRutaAuth =
      path.includes('/api/auth/refresh') ||
      path.includes('/api/auth/login') ||
      path.includes('/api/auth/registro')
    const necesitaRefresh =
      auth &&
      !esRutaAuth &&
      (res.status === 401 ||
        (res.status === 403 && tokenEnMemoria !== null))
    if (necesitaRefresh) {
      const refreshed = await intentarRefresh()
      if (refreshed?.token) {
        res = await ejecutarFetch(path, {
          method,
          body,
          headers,
          signal: requestSignal.signal,
          includeAuth: true,
        })
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (!requestSignal.timedOut()) {
        throw new ApiError('La petición se canceló', 0, null)
      }
      throw new ApiError(
        `La petición tardó demasiado (más de ${timeoutMs}ms) y se canceló`,
        0,
        null,
      )
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Error de red al contactar con el servidor',
      0,
      null,
    )
  } finally {
    requestSignal.cleanup()
  }

  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(text || res.statusText || `Error ${res.status} del servidor`, res.status, text || null)
  }

  return {
    blob: await res.blob(),
    filename: filenameFromDisposition(res.headers.get('Content-Disposition')),
  }
}

function filenameFromDisposition(value: string | null): string | undefined {
  if (!value) return undefined
  const utf8 = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8?.[1]) return decodeURIComponent(utf8[1].replace(/^"|"$/g, ''))
  const ascii = value.match(/filename="?([^";]+)"?/i)
  return ascii?.[1]
}

export const api: ApiClient = {
  base: API_BASE,
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
}

export const endpoints = {
  login: (credentials) => api.post('/api/auth/login', credentials, { auth: false }),
  register: (data) => api.post('/api/auth/registro', data, { auth: false }),
  // /refresh y /logout viven sin Authorization Bearer — el backend lee la
  // cookie httpOnly. credentials: 'include' del request global hace el resto.
  refresh: () => api.post('/api/auth/refresh', undefined, { auth: false }),
  logout: () => api.post('/api/auth/logout', undefined, { auth: false }),
  revokeAll: () => api.post('/api/auth/revoke-all', undefined),
  // Verificación de email. /verify es público (el link
  // viene del correo); /resend-verification requiere estar logueado.
  verifyEmail: (token) =>
    api.get(`/api/auth/verify?token=${encodeURIComponent(token)}`, { auth: false }),
  resendVerification: () => api.post('/api/auth/resend-verification', undefined),
  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (data) =>
    api.post('/api/auth/reset-password', data, { auth: false }),
  // 2FA TOTP.
  //   setup2fa: autenticado. Genera secret y devuelve { secret, otpauthUri, qrCodeDataUri }.
  //   enable2fa: autenticado. Body { codigo }. Devuelve { backupCodes: [...] }.
  //   disable2fa: autenticado. Body { password, codigo }.
  //   verifyLogin2fa: sin auth (usa challengeToken). Body { challengeToken, codigo }.
  //   regenerateBackupCodes: autenticado. Body { codigo } (TOTP code para confirmar).
  setup2fa: () => api.post('/api/auth/2fa/setup', undefined),
  enable2fa: (codigo) => api.post('/api/auth/2fa/enable', { codigo }),
  disable2fa: (password, codigo) =>
    api.post('/api/auth/2fa/disable', { password, codigo }),
  verifyLogin2fa: (challengeToken, codigo) =>
    api.post(
      '/api/auth/2fa/verify-login',
      { challengeToken, codigo },
      { auth: false },
    ),
  regenerateBackupCodes: (codigo) =>
    api.post('/api/auth/2fa/backup-codes/regenerar', { codigo }),
  // Notificaciones in-app.
  notificaciones: ({ soloNoLeidas = false, page = 0, size = 20 } = {}) =>
    api.get(
      `/api/notificaciones?soloNoLeidas=${soloNoLeidas}&page=${page}&size=${size}`,
    ),
  notificacionesUnreadCount: () =>
    api.get('/api/notificaciones/unread-count'),
  notificacionMarcarLeida: (id) =>
    api.post(`/api/notificaciones/${id}/leida`, undefined),
  notificacionesMarcarTodasLeidas: () =>
    api.post('/api/notificaciones/marcar-todas-leidas', undefined),
  pushPublicKey: () => api.get('/api/me/push/public-key'),
  pushSubscribe: ({ endpoint, keys }) =>
    api.post('/api/me/push/subscribe', { endpoint, keys }),
  pushUnsubscribe: (endpoint) =>
    api.del('/api/me/push/unsubscribe', { body: endpoint ? { endpoint } : undefined }),
  // Logros / badges.
  //   logros: público, devuelve el catálogo completo de badges.
  //   misLogros: autenticado, catálogo enriquecido con desbloqueadoEn null/timestamp.
  //   logrosStats: público, counts por badge { codigo: count }.
  //   personajesSimilares: público, recomendaciones cross-anime
  //     por slug. Devuelve PersonajeSimilarDto[] con score y votos.
  logros: () => api.get('/api/logros', { auth: false }),
  misLogros: () => api.get('/api/logros/mios'),
  logrosStats: () => api.get('/api/logros/stats', { auth: false }),
  desbloquearOtakuCertificado: () => api.post('/api/logros/otaku-certificado', undefined),
  // Eventos temáticos publicados (semanas/copas). Público; el front cae al
  // hardcode de data/eventos.js si la lista viene vacía o la llamada falla.
  eventos: () => api.get('/api/eventos', { auth: false }),
  // Cartas coleccionables. Todas autenticadas (auth por defecto).
  // Salón Legendario: galería pública de cartas especiales curadas.
  especialesCuradas: () => api.get('/api/cartas/especiales', { auth: false }),
  // Cabecera de la colección (totales, saldo, pity, progreso) sin el array de cartas.
  coleccionResumen: () => api.get('/api/me/cartas/resumen'),
  // Página del grid filtrada por rareza/anime. 'TODAS'/'TODOS' = sin filtro.
  coleccionPagina: ({ rareza, anime, orden, offset = 0, limit = 60 }) => {
    const params = new URLSearchParams()
    if (rareza && rareza !== 'TODAS') params.set('rareza', rareza)
    if (anime && anime !== 'TODOS') params.set('anime', anime)
    if (orden) params.set('orden', orden)
    params.set('offset', String(offset))
    params.set('limit', String(limit))
    return api.get(`/api/me/cartas/pagina?${params.toString()}`)
  },
  miMonedero: () => api.get('/api/me/monedero'),
  // Wrapped: resumen de actividad del usuario autenticado (privado).
  miWrapped: () => api.get('/api/wrapped/me'),
  // Opt-in público del Wrapped: el dueño activa/desactiva compartirlo por URL.
  setWrappedPublico: (publico: boolean) => api.patch('/api/wrapped/me/publico', { publico }),
  // Wrapped público de un usuario por username (404 si privado o no existe).
  wrappedPublico: (username: string) => api.get(`/api/wrapped/u/${encodeURIComponent(username)}`),
  // Marcos de avatar (cosmético coin-sink). Catálogo + estado (saldo, poseído,
  // equipado); comprar (débito) y equipar/desequipar devuelven el mismo estado.
  misMarcos: () => api.get('/api/me/marcos'),
  comprarMarco: (id: string) =>
    api.post(`/api/me/marcos/${encodeURIComponent(id)}/comprar`, undefined),
  equiparMarco: (marcoId: string | null) =>
    api.post('/api/me/marcos/equipar', { marcoId: marcoId ?? null }),
  oddsCartas: () => api.get('/api/cartas/odds'),
  abrirSobre: (idempotencyKey: string) => {
    const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : ''
    if (!key) {
      throw new Error('X-Idempotency-Key es obligatorio para abrir sobres')
    }
    return api.post('/api/me/cartas/sobre', undefined, {
      headers: { 'X-Idempotency-Key': key },
    })
  },
  cofreDiario: () => api.post('/api/me/cartas/cofre-diario', undefined),
  // Sobre de bienvenida: gratis, una sola vez, con especial garantizada.
  sobreBienvenida: () => api.post('/api/me/cartas/sobre-bienvenida', undefined),
  // Sobres gratis pendientes (recompensas de evento) + canje de un credito.
  sobresGratis: () => api.get('/api/me/cartas/sobres-gratis'),
  abrirSobreGratis: (creditoId) =>
    api.post(`/api/me/cartas/sobres-gratis/${encodeURIComponent(creditoId)}/abrir`, undefined),
  descargarCarta: (cartaId) =>
    requestBlob(`/api/me/cartas/${encodeURIComponent(cartaId)}/descargar`, {
      timeoutMs: 15000,
    }),
  personajesSimilares: (slug, { limit = 8 } = {}) =>
    api.get(
      `/api/personajes/${encodeURIComponent(slug)}/similares?limit=${limit}`,
      { auth: false },
    ),
  // Galería multi-imagen oficial. Devuelve hasta
  // 12 URLs de Jikan /characters/{mal_id}/pictures. 404 solo si el slug
  // no existe; lista vacía si Jikan no resuelve mal_id o cae circuit.
  imagenesPersonaje: (slug) =>
    api.get(`/api/personajes/${encodeURIComponent(slug)}/imagenes`, { auth: false }),
  // Time machine del ELO: serie {fecha, votosAcumulados}
  // por día. dias 1..90, default 30.
  // Historial competitivo de un personaje.
  // Ambos endpoints son públicos y devuelven 404 si el slug no existe.
  duelosRecientesPersonaje: (slug, { limit = 10 } = {}) =>
    api.get(`/api/personajes/${encodeURIComponent(slug)}/duelos-recientes?limit=${limit}`, { auth: false }),
  matchupsPersonaje: (slug) =>
    api.get(`/api/personajes/${encodeURIComponent(slug)}/matchups`, { auth: false }),
  comentariosPersonaje: (slug, { page = 0, size = 10 } = {}) =>
    api.get(
      `/api/personajes/${encodeURIComponent(slug)}/comentarios?page=${page}&size=${size}`,
    ),
  crearComentarioPersonaje: (slug, contenido) =>
    api.post(`/api/personajes/${encodeURIComponent(slug)}/comentarios`, {
      contenido,
    }),
  editarComentario: (id, contenido) =>
    api.put(`/api/comentarios/${id}`, { contenido }),
  eliminarComentario: (id) => api.del(`/api/comentarios/${id}`),
  reportarComentario: (id) =>
    api.post(`/api/comentarios/${id}/reportar`, undefined),
  adminComentarios: ({ estado = 'PENDIENTE_REVISION', page = 0, size = 20 } = {}) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    if (estado) params.set('estado', estado)
    return api.get(`/api/admin/comentarios?${params}`)
  },
  adminCambiarEstadoComentario: (id, estado) =>
    api.put(`/api/admin/comentarios/${id}/estado`, { estado }),
  adminAssetCoverage: () => api.get('/api/admin/assets/coverage'),

  // Actividad reciente de votos (sprint 2026-05-18). Públicos sin auth.
  // Individual para fichas, batch para listas (Pulso Movers, Favoritos).
  votosPeriodoPersonaje: (slug, { dias = 7 } = {}) =>
    api.get(`/api/personajes/${encodeURIComponent(slug)}/votos-periodo?dias=${dias}`, { auth: false }),
  votosPeriodoBatch: ({ slugs = [], dias = 7 } = {}) => {
    const lista = (Array.isArray(slugs) ? slugs : [])
      .filter(Boolean)
      .slice(0, 50)
      .join(',')
    if (!lista) return Promise.resolve([])
    return api.get(`/api/personajes/votos-periodo?slugs=${encodeURIComponent(lista)}&dias=${dias}`, { auth: false })
  },

  // Mi roster / favoritos. Todos requieren auth.
  // POST/DELETE son idempotentes server-side, así el hook puede hacer
  // optimistic update sin chequear estado previo.
  misFavoritos: () => api.get('/api/me/favoritos'),
  seguirPersonaje: (slug) =>
    api.post(`/api/personajes/${encodeURIComponent(slug)}/favorito`, undefined),
  dejarDeSeguirPersonaje: (slug) =>
    api.del(`/api/personajes/${encodeURIComponent(slug)}/favorito`),
  estadoFavoritoPersonaje: (slug) =>
    api.get(`/api/personajes/${encodeURIComponent(slug)}/favorito`),
  personajeEloHistory: (slug, { dias = 30 } = {}) =>
    api.get(
      `/api/personajes/${encodeURIComponent(slug)}/elo-history?dias=${dias}`,
      { auth: false },
    ),
  personajesEloHistoryBatch: (slugs, { dias = 7 } = {}) => {
    const csv = (slugs ?? []).map(encodeURIComponent).join(',')
    return api.get(
      `/api/personajes/elo-history?slugs=${csv}&dias=${dias}`,
      { auth: false },
    )
  },
  // Reactions.
  //   getReacciones: público, devuelve {counts, miReaccion, total}.
  //   aplicarReaccion: autenticado. Backend gestiona toggle/swap automático.
  getReacciones: (targetType, targetId) =>
    api.get(
      `/api/reacciones?targetType=${targetType}&targetId=${targetId}`,
    ),
  aplicarReaccion: ({ targetType, targetId, tipo }) =>
    api.post('/api/reacciones', { targetType, targetId, tipo }),
  // Predicciones de bracket.
  //   aplicarPrediccion: autenticado. Backend INSERT/UPDATE según UNIQUE.
  //   misPredicciones(torneoId): autenticado. Lista del torneo concreto.
  //   leaderboardPredicciones: público. Top predictores últimos N días.
  aplicarPrediccion: ({ enfrentamientoId, personajePredichoId }) =>
    api.post('/api/predicciones', { enfrentamientoId, personajePredichoId }),
  aplicarPrediccionCampeon: ({ torneoId, personajePredichoId }) =>
    api.post('/api/predicciones/campeon', { torneoId, personajePredichoId }),
  misPredicciones: (torneoId) =>
    api.get(`/api/predicciones/mias/torneo/${torneoId}`),
  leaderboardPredicciones: ({ dias = 30, limit = 10 } = {}) =>
    api.get(
      `/api/predicciones/leaderboard?dias=${dias}&limit=${limit}`,
      { auth: false },
    ),
  leaderboardPrediccionesTorneo: ({ torneoId, limit = 10 }) =>
    api.get(`/api/predicciones/leaderboard/torneo/${torneoId}?limit=${limit}`, {
      auth: false,
    }),
  // Perfil del usuario autenticado.
  perfilStats: () => api.get('/api/perfil/me/stats'),
  migrarVotosAnonimos: () =>
    api.post('/api/perfil/me/migrar-votos-anonimos', undefined),
  perfilTop: ({ limit = 5 } = {}) =>
    api.get(`/api/perfil/me/top?limit=${limit}`),
  // Feed combinado de actividad: votos, logros, torneos creados,
  // predicciones acertadas. Cada item con {tipo, fecha, payload}.
  perfilActividad: ({ limit = 20 } = {}) =>
    api.get(`/api/perfil/me/actividad?limit=${limit}`),
  // Referral del usuario: código único + count
  // verificados + tier badge.
  perfilReferral: () => api.get('/api/perfil/me/referral'),
  // Actualiza la bio pública. El backend la sanitiza (texto plano, máx 240)
  // y devuelve el UsuarioRespuesta con la bio normalizada (campo `bio`).
  changeBio: (bio: string) => api.patch('/api/perfil/me/bio', { bio }),
  // GDPR right to erasure. Requiere password de nuevo
  // en el body como reconfirmación; 400 si la password no coincide.
  // Tras éxito el backend limpia la cookie de refresh; el cliente debe
  // además limpiar tokens locales y redirigir a home.
  eliminarMiCuenta: ({ password }) =>
    api.del('/api/perfil/me', { body: { password } }),
  // Perfil PÚBLICO de cualquier usuario. Endpoint
  // permitAll en el backend, pero si el caller está logueado el token
  // viaja y el backend rellena `siguiendo` y `esMismoUsuario`. Si no
  // hay token, esos campos vienen como null/false.
  perfilPublico: (username) =>
    api.get(`/api/perfil/${encodeURIComponent(username)}`),
  // Friends / follow asimétrico. seguir/dejarDeSeguir son
  // idempotentes en el backend — la UI no necesita comprobar estado previo.
  seguir: (usuarioId) =>
    api.post(`/api/seguidores/${usuarioId}`),
  dejarDeSeguir: (usuarioId) =>
    api.del(`/api/seguidores/${usuarioId}`),
  // B7 §2: feed de comunidad (actividad de los seguidos). Autenticado y
  // paginado. Devuelve { items, hasMore, sigueAAlguien }.
  feed: ({ page = 0, size = 20 } = {}) =>
    api.get(`/api/feed?page=${page}&size=${size}`),
  // Ranking segmentado.
  //   rankingSegmentado: periodo all|mes|trimestre|anio, anime opcional toma
  //     precedencia, limit max 200.
  //   animesConVotos: lista de animes con al menos 1 voto, para popular
  //     el dropdown del tab 'Por anime'.
  // Ranking actual con indicadores de movimiento:
  // delta vs hace N días + flag esNuevo para personajes que no aparecían.
  rankingMovimientos: ({ limit = 50, dias = 7 } = {}) =>
    api.get(`/api/votos/ranking/movimientos?limit=${limit}&dias=${dias}`, {
      auth: false,
    }),
  rankingSegmentado: ({ periodo = 'all', anime, categoria, limit = 50 } = {}) => {
    const params = new URLSearchParams({ periodo, limit: String(limit) })
    if (anime) params.set('anime', anime)
    // Intención de voto (feature #15). anime tiene precedencia en el backend;
    // categoria es aditivo y se ignora si es inválida.
    if (categoria) params.set('categoria', categoria)
    return api.get(`/api/votos/ranking/segmentado?${params}`, {
      auth: false,
    })
  },
  // ELO canónico por slug de todo el catálogo (semilla popularidad +15% + votos).
  // Lo usa la pestaña ELO de /ranking para el ELO real en vez del sintético.
  eloCanonico: () =>
    api.get('/api/votos/ranking/elo-canonico', { auth: false }),
  animesConVotos: () =>
    api.get('/api/votos/ranking/animes-disponibles', { auth: false }),
  // Categorías de intención (feature #15) con al menos un voto, para no pintar
  // chips vacíos en el sub-selector 'Por intención' de /ranking.
  categoriasConVotos: () =>
    api.get('/api/votos/ranking/categorias-disponibles', { auth: false }),
  // Top voters leaderboard. periodo: all|semana|mes.
  topVoters: ({ periodo = 'all', limit = 10 } = {}) =>
    api.get(`/api/votos/top-voters?periodo=${periodo}&limit=${limit}`, { auth: false }),
  fantasyMe: () => api.get('/api/fantasy/me'),
  fantasyCandidatos: ({ q = '', limit = 80 } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (q) params.set('q', q)
    return api.get(`/api/fantasy/candidatos?${params}`)
  },
  fantasyGuardarEquipo: (personajeIds) =>
    api.put('/api/fantasy/me/equipo', { personajeIds }),
  fantasyBloquearEquipo: () =>
    api.post('/api/fantasy/me/equipo/lock', undefined),
  fantasyLeaderboard: ({ semanaIso, limit = 50 } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (semanaIso) params.set('semanaIso', semanaIso)
    return api.get(`/api/fantasy/leaderboard?${params}`, { auth: false })
  },
  // Newsletter con double opt-in.
  suscribirNewsletter: (email) =>
    api.post('/api/newsletter', { email }, { auth: false }),
  confirmarNewsletter: (token) =>
    api.get(`/api/newsletter/confirmar?token=${encodeURIComponent(token)}`, {
      auth: false,
    }),
  unsubscribeNewsletter: (token) =>
    api.post(
      `/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
      undefined,
      { auth: false },
    ),
  status: () => api.get('/api/status', { auth: false }),
  me: () => api.get('/api/auth/me'),
  updateAvatar: (avatarUrl) => api.put('/api/auth/me/avatar', { avatarUrl }),
  updateBanner: (bannerUrl) => api.put('/api/auth/me/banner', { bannerUrl }),
  changePassword: (currentPassword, newPassword) =>
    api.put('/api/auth/me/password', { currentPassword, newPassword }),
  // V-8 onboarding: cambia el username. Devuelve { token, usuario } con un JWT
  // fresco (el subject del JWT es el username, así que hay que reemplazar el
  // token en memoria para no romper la sesión hasta el siguiente refresh).
  changeUsername: (username) =>
    api.put('/api/auth/me/username', { username }),
  // Chequeo en vivo de disponibilidad (debounce en el componente). Devuelve
  // { available, reason? }. timeout corto: es teclear-y-comprobar.
  usernameAvailable: (u, { signal } = {}) =>
    api.get(`/api/auth/me/username-available?u=${encodeURIComponent(u || '')}`, {
      signal,
      timeoutMs: 4000,
    }),
  // Marca el onboarding como visto ("Saltar por ahora" o cerrar el modal).
  skipOnboarding: () => api.post('/api/auth/me/onboarding/skip'),
  personajes: ({ page = 0, size = 50, anime } = {}) => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('size', String(size))
    if (anime) params.set('anime', anime)
    return api.get(`/api/personajes?${params.toString()}`)
  },
  personajesCatalogo: ({ fields = 'slug,nombre,anime,imagenUrl' } = {}) =>
    api.get(`/api/personajes/catalogo?fields=${encodeURIComponent(fields)}`, {
      auth: false,
      timeoutMs: 8000,
    }),
  personajeAleatorio: ({ exclude } = {}) => {
    const params = new URLSearchParams()
    if (exclude) params.set('exclude', exclude)
    const query = params.toString()
    return api.get(
      `/api/personajes/aleatorio${query ? `?${query}` : ''}`,
      { auth: false, timeoutMs: 4000 },
    )
  },
  buscarPersonajes: ({ q, limit = 10, signal } = {}) =>
    api.get(
      `/api/personajes/buscar?q=${encodeURIComponent(q || '')}&limit=${limit}`,
      { auth: false, signal, timeoutMs: 4000 },
    ),
  personaje: (id) => api.get(`/api/personajes/${id}`),
  createPersonaje: (data) => api.post('/api/personajes', data),
  deletePersonaje: (id) => api.del(`/api/personajes/${id}`),
  // Listado de torneos en formato TorneoResumenDto:
  // id, slug, nombre, estado, fechas, numParticipantes, totalRondas,
  // rondaActual, ganadorSlug. Sin enfrentamientos — para eso usar
  // torneoBySlug.
  torneos: () => api.get('/api/torneos', { auth: false }),
  torneo: (id) => api.get(`/api/torneos/${id}`, { auth: false }),
  // Detalle por slug con bracket completo: TorneoDetalleDto. Es la ruta
  // canonical que consume TorneoDetailPage (/torneos/[slug]) — coincide
  // con la URL del frontend para que el polling y el cache sean limpios.
  torneoBySlug: (slug) => api.get(`/api/torneos/slug/${slug}`, { auth: false }),
  createTorneo: (data) => api.post('/api/torneos', data),
  // Torneos creados por usuario verificado.
  //   crearTorneoMio: body { nombre, descripcion?, publico?, participantesIds[8|16] }
  //     -> 201 con Torneo en estado SCHEDULED/PENDIENTE. Necesita email
  //     verificado o el backend devuelve 400.
  //   misTorneos: lista del propio creador, todos los estados de revisión.
  //   torneosPendientes / aprobar / rechazar: admin only.
  crearTorneoMio: ({ nombre, descripcion, publico = true, participantesIds }) =>
    api.post('/api/torneos/mio', { nombre, descripcion, publico, participantesIds }),
  misTorneos: () => api.get('/api/torneos/mios'),
  tierListsMine: () => api.get('/api/tier-lists/mine'),
  tierListOwn: (id) => api.get(`/api/tier-lists/${encodeURIComponent(id)}`),
  tierListCreate: (data) => api.post('/api/tier-lists', data),
  tierListUpdate: (id, data) => api.put(`/api/tier-lists/${encodeURIComponent(id)}`, data),
  tierListDelete: (id) => api.del(`/api/tier-lists/${encodeURIComponent(id)}`),
  tierListPublic: (slug) =>
    api.get(`/api/tier-lists/public/${encodeURIComponent(slug)}`, { auth: false }),
  torneosPendientes: () => api.get('/api/admin/torneos/pendientes'),
  aprobarTorneo: (id) => api.put(`/api/admin/torneos/${id}/aprobar`),
  rechazarTorneo: (id, motivo) =>
    api.put(`/api/admin/torneos/${id}/rechazar`, { motivo }),
  // Inicia el torneo y opcionalmente precomputa el bracket si pasas
  // participantesIds. Sin ese array, solo cambia estado a IN_PROGRESS.
  iniciarTorneo: (id, participantesIds = undefined) =>
    api.put(
      `/api/torneos/${id}/iniciar`,
      participantesIds ? { participantesIds } : undefined,
    ),
  // deleteTorneo eliminado: TorneoController no expone @DeleteMapping todavía,
  // si el frontend lo llamaba caía con 405. Se restaurará cuando se implemente backend-side.
  ranking: () => api.get('/api/votos/ranking'),
  // Feed público "últimos votos". Lo
  // consume SectionPulso para pintar actividad real ("X votó por Y vs Z
  // hace 2 min"). Limit acotado server-side a [1, 20].
  votosRecientes: ({ limit = 10 } = {}) =>
    api.get(`/api/votos/recientes?limit=${limit}`, { auth: false }),
  // Siguiente match abierto. El backend excluye ids vistos y duelos ya
  // votados por el usuario/cookie anónima. Devuelve 404 si no quedan matches.
  enfrentamientoSiguiente: ({ excludeIds = [], anonymous = false, headers = {} } = {}) => {
    const params = new URLSearchParams()
    const ids = Array.isArray(excludeIds)
      ? excludeIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
          .slice(-100)
      : []
    if (ids.length > 0) params.set('excludeIds', ids.join(','))
    const query = params.toString()
    return api.get(`/api/enfrentamientos/siguiente${query ? `?${query}` : ''}`, {
      auth: !anonymous,
      headers,
    })
  },
  // Alias legacy: mantenido para consumidores antiguos.
  enfrentamientoAleatorio: () => api.get('/api/enfrentamientos/siguiente', { auth: false }),
  dueloSugerido: () => api.get('/api/votar/sugerir-duelo', { auth: false }),
  eloDuelRound: () => api.get('/api/games/elo-duel/round', { auth: false }),
  // Auth OPCIONAL: el endpoint es público (el anónimo juega sin token), pero si
  // hay sesión adjuntamos el Bearer para que el server acredite moneda al acierto
  // (validado en server). Por eso NO lleva { auth: false }.
  eloDuelGuess: ({ roundToken, choice }) =>
    api.post('/api/games/elo-duel/guess', { roundToken, choice }),
  dueloLiveActive: () => api.get('/api/duelo-live/active'),
  dueloLiveJoin: () => api.post('/api/duelo-live/queue', undefined),
  dueloLiveState: (id) => api.get(`/api/duelo-live/${id}`),
  dueloLiveVote: (id, choice) => api.post(`/api/duelo-live/${id}/vote`, { choice }),
  dueloLiveLeave: (id) => api.post(`/api/duelo-live/${id}/leave`, undefined),
  votar: (enfrentamientoId, personajeId, { anonymous = false, headers = {}, categoria, empate = false } = {}) =>
    // Voto normal: personajeGanadorId. Empate neutral: solo empate=true para
    // que backend reparta medio voto a cada lado sin mover ELO.
    // categoria (intención de voto, feature #15) es opcional: se omite del body
    // cuando no se eligió → el backend la guarda como null (voto sin intención).
    api.post(`/api/enfrentamientos/${enfrentamientoId}/votar`, {
      ...(empate ? { empate: true } : { personajeGanadorId: personajeId }),
      ...(categoria ? { categoria } : {}),
    }, { auth: !anonymous, headers }),
  // Set-once de la intención de un voto YA emitido (feature #15). El arena es
  // 1 tap al ganador; la categoría llega en un segundo tap opcional desde el
  // panel de resultado. 204 al fijarla; 409 si ya estaba puesta (inmutable).
  setCategoriaVoto: (enfrentamientoId, categoria, { anonymous = false, headers = {} } = {}) =>
    api.patch(`/api/enfrentamientos/${enfrentamientoId}/votar/categoria`, {
      categoria,
    }, { auth: !anonymous, headers }),
  // satisfies (no anotación): preserva el tipo literal de `endpoints`, así que
  // acceder a una clave inexistente (p.ej. un endpoint mal escrito o borrado)
  // falla en compilación, mientras el constraint da tipado contextual a los
  // params de los métodos.
} satisfies EndpointMap
