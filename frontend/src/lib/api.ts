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
  get: (path: string, opts?: RequestOptions) => Promise<unknown>
  post: (path: string, body?: unknown, opts?: RequestOptions) => Promise<unknown>
  put: (path: string, body?: unknown, opts?: RequestOptions) => Promise<unknown>
  patch: (path: string, body?: unknown, opts?: RequestOptions) => Promise<unknown>
  del: (path: string, opts?: RequestOptions) => Promise<unknown>
}

type EndpointMap = Record<string, (...args: any[]) => any>

function normalizarApiBase(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    if (import.meta.env.DEV) return DEV_API_BASE
    return PROD_API_BASE
  }
  try {
    const url = new URL(raw)
    if (import.meta.env.PROD && /\.up\.railway\.app$/i.test(url.hostname)) {
      console.warn('[api] VITE_API_URL apunta a Railway; usa el dominio canónico del API en producción.')
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    if (import.meta.env.DEV) return DEV_API_BASE
    throw new Error('VITE_API_URL debe ser una URL válida')
  }
}

export const API_BASE = normalizarApiBase(import.meta.env.VITE_API_URL)

// El JWT vive en memoria, no en localStorage. La sesión
// persistente la da el refresh_token cookie httpOnly que pone el backend
// — esa cookie no la pueden tocar scripts (defensa XSS) y solo viaja a
// nuestro propio dominio en peticiones credentialed (defensa CSRF).
//
// Bootstrap: al abrir la app, AuthContext llama refreshSession() para
// intentar conseguir un JWT fresco usando la cookie persistente. Si éxito
// el usuario sigue logueado; si fallo aparece como invitado.
let tokenEnMemoria: string | null = null

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

  let res
  try {
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
    // Excluimos los propios endpoints auth para no entrar en bucle.
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

export const api: ApiClient = {
  base: API_BASE,
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
}

export const endpoints: EndpointMap = {
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
  misPredicciones: (torneoId) =>
    api.get(`/api/predicciones/mias/torneo/${torneoId}`),
  leaderboardPredicciones: ({ dias = 30, limit = 10 } = {}) =>
    api.get(
      `/api/predicciones/leaderboard?dias=${dias}&limit=${limit}`,
      { auth: false },
    ),
  // Perfil del usuario autenticado.
  perfilStats: () => api.get('/api/perfil/me/stats'),
  perfilHistorialVotos: ({ page = 0, size = 50 } = {}) =>
    api.get(`/api/perfil/me/historial-votos?page=${page}&size=${size}`),
  migrarVotosAnonimos: (anonSessionId) =>
    api.post('/api/perfil/me/migrar-votos-anonimos', { anonSessionId }),
  perfilTop: ({ limit = 5 } = {}) =>
    api.get(`/api/perfil/me/top?limit=${limit}`),
  // Feed combinado de actividad: votos, logros, torneos creados,
  // predicciones acertadas. Cada item con {tipo, fecha, payload}.
  perfilActividad: ({ limit = 20 } = {}) =>
    api.get(`/api/perfil/me/actividad?limit=${limit}`),
  // Referral del usuario: código único + count
  // verificados + tier badge.
  perfilReferral: () => api.get('/api/perfil/me/referral'),
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
  rankingSegmentado: ({ periodo = 'all', anime, limit = 50 } = {}) => {
    const params = new URLSearchParams({ periodo, limit: String(limit) })
    if (anime) params.set('anime', anime)
    return api.get(`/api/votos/ranking/segmentado?${params}`, {
      auth: false,
    })
  },
  animesConVotos: () =>
    api.get('/api/votos/ranking/animes-disponibles', { auth: false }),
  // Top voters leaderboard. periodo: all|semana|mes.
  topVoters: ({ periodo = 'all', limit = 10 } = {}) =>
    api.get(`/api/votos/top-voters?periodo=${periodo}&limit=${limit}`, { auth: false }),
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
  personajes: () => api.get('/api/personajes'),
  personajesCatalogo: ({ fields = 'slug,nombre,anime,imagenUrl' } = {}) =>
    api.get(`/api/personajes/catalogo?fields=${encodeURIComponent(fields)}`, {
      auth: false,
      timeoutMs: 8000,
    }),
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
  torneos: () => api.get('/api/torneos'),
  torneo: (id) => api.get(`/api/torneos/${id}`),
  // Detalle por slug con bracket completo: TorneoDetalleDto. Es la ruta
  // canonical que consume TorneoDetailPage (/torneos/[slug]) — coincide
  // con la URL del frontend para que el polling y el cache sean limpios.
  torneoBySlug: (slug) => api.get(`/api/torneos/slug/${slug}`),
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
  torneosPendientes: () => api.get('/api/admin/torneos/pendientes'),
  aprobarTorneo: (id) => api.put(`/api/admin/torneos/${id}/aprobar`),
  rechazarTorneo: (id, motivo) =>
    api.put(`/api/admin/torneos/${id}/rechazar`, { motivo }),
  // Inicia el torneo y opcionalmente precomputa el bracket si pasas
  // participantesIds. Sin ese array, solo cambia estado a IN_PROGRESS.
  iniciarTorneo: (id, participantesIds) =>
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
  // Match aleatorio abierto. Devuelve EnfrentamientoDto o
  // 404 (modo casual del frontend toma el control). No requiere auth.
  enfrentamientoAleatorio: () => api.get('/api/enfrentamientos/aleatorio', { auth: false }),
  dueloSugerido: () => api.get('/api/votar/sugerir-duelo', { auth: false }),
  dueloLiveActive: () => api.get('/api/duelo-live/active'),
  dueloLiveJoin: () => api.post('/api/duelo-live/queue', undefined),
  dueloLiveState: (id) => api.get(`/api/duelo-live/${id}`),
  dueloLiveVote: (id, choice) => api.post(`/api/duelo-live/${id}/vote`, { choice }),
  dueloLiveLeave: (id) => api.post(`/api/duelo-live/${id}/leave`, undefined),
  votar: (enfrentamientoId, personajeId, { anonymous = false, headers = {} } = {}) =>
    // El backend espera el campo personajeGanadorId (validado con @NotNull en
    // VotoEnfrentamientoRequest); antes mandábamos personajeId y rebotaba con 400.
    api.post(`/api/enfrentamientos/${enfrentamientoId}/votar`, {
      personajeGanadorId: personajeId,
    }, { auth: !anonymous, headers }),
}
