const DEFAULT_API_BASE = 'https://api.animeshowdown.dev'

function normalizarApiBase(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return DEFAULT_API_BASE
  try {
    const url = new URL(raw)
    // En producción OAuth y refresh dependen de cookies del subdominio API.
    // Si Cloudflare Pages inyecta el dominio bruto de Railway, el login social
    // empieza en railway.app pero Google vuelve a api.animeshowdown.dev: el
    // state OAuth no viaja y aparece [authorization_request_not_found].
    if (import.meta.env.PROD && /\.up\.railway\.app$/i.test(url.hostname)) {
      return DEFAULT_API_BASE
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return DEFAULT_API_BASE
  }
}

const API_BASE = normalizarApiBase(import.meta.env.VITE_API_URL)

// Plan v2 §1.3: el JWT vive en MEMORIA, no en localStorage. La sesión
// persistente la da el refresh_token cookie httpOnly que pone el backend
// — esa cookie no la pueden tocar scripts (defensa XSS) y solo viaja a
// nuestro propio dominio en peticiones credentialed (defensa CSRF).
//
// Bootstrap: al abrir la app, AuthContext llama refreshSession() para
// intentar conseguir un JWT fresco usando la cookie persistente. Si éxito
// el usuario sigue logueado; si fallo aparece como invitado.
let tokenEnMemoria = null

export function getToken() {
  return tokenEnMemoria
}

// Audit P1 (2026-05-17): listeners para "token cambió". Permite a stomp.js
// reconectar con JWT nuevo tras refresh silencioso (auto-refresh tras 401).
// Sin esto, el WS singleton seguía con el JWT viejo hasta logout/reload.
const tokenChangeListeners = new Set()
export function onTokenChange(cb) {
  tokenChangeListeners.add(cb)
  return () => tokenChangeListeners.delete(cb)
}
function notifyTokenChange() {
  for (const cb of tokenChangeListeners) {
    try { cb(tokenEnMemoria) } catch { /* listener errors aren't ours */ }
  }
}

export function setToken(token) {
  const prev = tokenEnMemoria
  tokenEnMemoria = token || null
  if (prev !== tokenEnMemoria) notifyTokenChange()
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

// Timeout por defecto para todas las requests al backend. Antes el fetch no
// tenía timeout y se podía quedar colgado indefinidamente en redes lentas o si
// el backend tardaba en responder, dejando spinners eternos en el frontend.
const DEFAULT_TIMEOUT_MS = 10000

// Promesa singleton para deduplicar refresh paralelos. Si dos peticiones
// reciben 401 a la vez, ambas comparten el mismo intento de refresh —
// evitamos cosas raras como "rotar el refresh dos veces" que invalidaría
// la sesión por reuse-detection del backend.
let refreshPromise = null

// Audit P2 (2026-05-17, 4ª iter): flag que bloquea intentarRefresh durante
// el logout. Si una request paralela recibe 401 y dispara refresh DESPUÉS
// de que el user haya pulsado logout pero ANTES de que el backend revoque
// el refresh, el refresh "exitoso" emite una cookie nueva y resucita la
// sesión que el user acababa de cerrar. Al activar el flag, cualquier
// intentarRefresh devuelve null inmediato y la request queda 401-final.
let isLoggingOut = false
export function setLoggingOut(value) {
  isLoggingOut = Boolean(value)
}

// Audit P1 (2026-05-18, 5ª iter): epoch de sesión. setLoggingOut(true)
// cortaba refreshes NUEVOS, pero un refreshPromise YA en vuelo que
// resolviera después seguía aplicando setToken → resucitaba la sesión.
// Cada cambio de sesión (logout, login, refresh exitoso) incrementa el
// epoch; cuando intentarRefresh resuelve, comprueba que el epoch sigue
// siendo el suyo antes de propagar tokenEnMemoria / notify. Si cambió
// (otro flow ya pasó por ahí), descarta el resultado silenciosamente.
let sessionEpoch = 0
export function bumpSessionEpoch() {
  sessionEpoch++
}

/**
 * Audit P2 (2026-05-17, 4ª iter): grace cross-tab robusto.
 * El backend devuelve 503 + Retry-After cuando otra pestaña acaba de
 * rotar el refresh. El cliente respeta Retry-After (segundos) y hace
 * hasta GRACE_MAX_RETRIES intentos antes de considerar muerta la
 * sesión. Solo limpiamos tokenEnMemoria ante 401 explícito o cuando
 * agotamos retries — antes un único retry de 350ms podía perderse si
 * el navegador aún no había aplicado la cookie nueva al dominio.
 */
const GRACE_MAX_RETRIES = 3
const GRACE_MIN_DELAY_MS = 300

function parseRetryAfterMs(headerValue, fallbackMs) {
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

async function intentarRefresh() {
  if (isLoggingOut) return null
  if (refreshPromise) return refreshPromise
  // Captura el epoch al iniciar. Si cambia mientras la promesa está en
  // vuelo (logout, login en otra tab, etc.), no aplicamos el resultado.
  const myEpoch = sessionEpoch
  refreshPromise = (async () => {
    // Audit P2 (2026-05-18, 5ª iter): AbortController por intento para
    // que /refresh tenga timeout propio. Antes el cliente global tenía
    // timeout pero intentarRefresh hacía fetch directo sin abort, así
    // que bootstrap y 401-retries quedaban colgados.
    const doFetch = async () => {
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
      const data = await res.json()
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
export async function refreshSession() {
  return intentarRefresh()
}

async function ejecutarFetch(path, { method, headers, body, signal, includeAuth }) {
  // Audit fix #7 (2026-05-21): Content-Type: application/json solo cuando
  // hay body. En GET/HEAD sin body el header no aporta nada y dispara
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
  path,
  { method = 'GET', body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {},
) {
  // Si el caller pasa su propio signal lo respetamos; si no, montamos un
  // AbortController interno con el timeout configurado.
  const controller = signal ? null : new AbortController()
  const effectiveSignal = signal ?? controller.signal
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null

  let res
  try {
    res = await ejecutarFetch(path, {
      method,
      body,
      signal: effectiveSignal,
      includeAuth: auth,
    })

    // Auto-refresh on 401/403: si la petición autenticada falla con 401 o
    // 403 con token en memoria, intenta /refresh una vez. Si el refresh
    // funciona, reintenta la petición original con el nuevo token. Si el
    // refresh falla, propaga el error original.
    //
    // Audit fix #1 (2026-05-21): SecurityConfig devuelve 403 (no 401)
    // cuando llega una API call sin auth o con JWT expirado — esto es
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
          signal: effectiveSignal,
          includeAuth: true,
        })
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError(
        `La petición tardó demasiado (más de ${timeoutMs}ms) y se canceló`,
        0,
        null,
      )
    }
    throw new ApiError(
      err.message || 'Error de red al contactar con el servidor',
      0,
      null,
    )
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }

  const text = await res.text()
  let parsed = null
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
    throw new ApiError(
      (parsed && parsed.message) ||
        fallback ||
        res.statusText ||
        `Error ${res.status} del servidor`,
      res.status,
      parsed,
    )
  }
  return parsed
}

export const api = {
  base: API_BASE,
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
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
  // Verificación de email (Plan v2 §2.4). /verify es público (el link
  // viene del correo); /resend-verification requiere estar logueado.
  verifyEmail: (token) =>
    api.get(`/api/auth/verify?token=${encodeURIComponent(token)}`, { auth: false }),
  resendVerification: () => api.post('/api/auth/resend-verification', undefined),
  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (data) =>
    api.post('/api/auth/reset-password', data, { auth: false }),
  // 2FA TOTP (Plan v2 §2.3).
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
  // Notificaciones in-app (Plan v2 §2.13).
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
  // Logros / badges (Plan v2 §4.2).
  //   logros: público, devuelve catálogo completo de 14 badges.
  //   misLogros: autenticado, catálogo enriquecido con desbloqueadoEn null/timestamp.
  //   logrosStats: público (Plan v2 §4.10), counts por badge { codigo: count }.
  //   personajesSimilares: público (Plan v2 §4.12), recomendaciones cross-anime
  //     por slug. Devuelve PersonajeSimilarDto[] con score y votos.
  logros: () => api.get('/api/logros', { auth: false }),
  misLogros: () => api.get('/api/logros/mios'),
  logrosStats: () => api.get('/api/logros/stats', { auth: false }),
  personajesSimilares: (slug, { limit = 8 } = {}) =>
    api.get(
      `/api/personajes/${encodeURIComponent(slug)}/similares?limit=${limit}`,
      { auth: false },
    ),
  // Galería multi-imagen oficial (Plan v2 §4.12 step 1). Devuelve hasta
  // 12 URLs de Jikan /characters/{mal_id}/pictures. 404 solo si el slug
  // no existe; lista vacía si Jikan no resuelve mal_id o cae circuit.
  imagenesPersonaje: (slug) =>
    api.get(`/api/personajes/${encodeURIComponent(slug)}/imagenes`, { auth: false }),
  // Time machine del ELO (Plan v2 §11.1): serie {fecha, votosAcumulados}
  // por día. dias 1..90, default 30.
  // Historial competitivo de un personaje (Plan producto 2026-05-18).
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

  // Actividad reciente de votos (sprint 2026-05-18). Públicos sin auth.
  // Individual para fichas, batch para listas (Pulso Movers, Favoritos).
  votosPeriodoPersonaje: (slug, { dias = 7 } = {}) =>
    api.get(`/api/personajes/${encodeURIComponent(slug)}/votos-periodo?dias=${dias}`, { auth: false }),
  votosPeriodoBatch: ({ slugs, dias = 7 }) => {
    const lista = slugs.filter(Boolean).slice(0, 50).join(',')
    if (!lista) return Promise.resolve([])
    return api.get(`/api/personajes/votos-periodo?slugs=${encodeURIComponent(lista)}&dias=${dias}`, { auth: false })
  },

  // Mi roster / favoritos (Plan producto 2026-05-18). Todos requieren auth.
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
  // Reactions (Plan v2 §4.3).
  //   getReacciones: público, devuelve {counts, miReaccion, total}.
  //   aplicarReaccion: autenticado. Backend gestiona toggle/swap automático.
  getReacciones: (targetType, targetId) =>
    api.get(
      `/api/reacciones?targetType=${targetType}&targetId=${targetId}`,
    ),
  aplicarReaccion: ({ targetType, targetId, tipo }) =>
    api.post('/api/reacciones', { targetType, targetId, tipo }),
  // Predicciones de bracket (Plan v2 §4.4).
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
  // Perfil del usuario autenticado (Plan v2 §4.1).
  perfilStats: () => api.get('/api/perfil/me/stats'),
  perfilHistorialVotos: ({ page = 0, size = 50 } = {}) =>
    api.get(`/api/perfil/me/historial-votos?page=${page}&size=${size}`),
  perfilTop: ({ limit = 5 } = {}) =>
    api.get(`/api/perfil/me/top?limit=${limit}`),
  // Feed combinado de actividad: votos, logros, torneos creados,
  // predicciones acertadas. Cada item con {tipo, fecha, payload}.
  perfilActividad: ({ limit = 20 } = {}) =>
    api.get(`/api/perfil/me/actividad?limit=${limit}`),
  // Referral del usuario (Plan v2 §11.8): código único + count
  // verificados + tier badge.
  perfilReferral: () => api.get('/api/perfil/me/referral'),
  // GDPR right to erasure (Plan v2 §4.1). Requiere password de nuevo
  // en el body como reconfirmación; 400 si la password no coincide.
  // Tras éxito el backend limpia la cookie de refresh; el cliente debe
  // además limpiar tokens locales y redirigir a home.
  eliminarMiCuenta: ({ password }) =>
    api.del('/api/perfil/me', { body: { password } }),
  // Perfil PÚBLICO de cualquier usuario (Plan v2 §4.5). Endpoint
  // permitAll en el backend, pero si el caller está logueado el token
  // viaja y el backend rellena `siguiendo` y `esMismoUsuario`. Si no
  // hay token, esos campos vienen como null/false.
  perfilPublico: (username) =>
    api.get(`/api/perfil/${encodeURIComponent(username)}`),
  // Friends / follow asimétrico (Plan v2 §4.5). seguir/dejarDeSeguir son
  // idempotentes en el backend — la UI no necesita comprobar estado previo.
  seguir: (usuarioId) =>
    api.post(`/api/seguidores/${usuarioId}`),
  dejarDeSeguir: (usuarioId) =>
    api.del(`/api/seguidores/${usuarioId}`),
  // Ranking segmentado (Plan v2 §4.6).
  //   rankingSegmentado: periodo all|mes|trimestre|anio, anime opcional toma
  //     precedencia, limit max 200.
  //   animesConVotos: lista de animes con al menos 1 voto, para popular
  //     el dropdown del tab 'Por anime'.
  // Ranking actual con indicadores de movimiento (Plan v2 §4.x):
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
  // Top voters leaderboard (Plan v2 §11.9). periodo: all|semana|mes.
  topVoters: ({ periodo = 'all', limit = 10 } = {}) =>
    api.get(`/api/votos/top-voters?periodo=${periodo}&limit=${limit}`, { auth: false }),
  // Newsletter con double opt-in (Plan v2 §4.8).
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
  // Listado de torneos en formato TorneoResumenDto (Plan v2 §1.1):
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
  // Plan v2 §4.9: torneos creados por usuario verificado.
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
  // Feed público "últimos votos" — Plan producto (2026-05-18). Lo
  // consume SectionPulso para pintar actividad real ("X votó por Y vs Z
  // hace 2 min"). Limit acotado server-side a [1, 20].
  votosRecientes: ({ limit = 10 } = {}) =>
    api.get(`/api/votos/recientes?limit=${limit}`, { auth: false }),
  // Match aleatorio abierto (Plan v2 §1.1). Devuelve EnfrentamientoDto o
  // 404 (modo casual del frontend toma el control). No requiere auth.
  enfrentamientoAleatorio: () => api.get('/api/enfrentamientos/aleatorio', { auth: false }),
  dueloSugerido: () => api.get('/api/votar/sugerir-duelo', { auth: false }),
  dueloLiveActive: () => api.get('/api/duelo-live/active'),
  dueloLiveJoin: () => api.post('/api/duelo-live/queue', undefined),
  dueloLiveState: (id) => api.get(`/api/duelo-live/${id}`),
  dueloLiveVote: (id, choice) => api.post(`/api/duelo-live/${id}/vote`, { choice }),
  dueloLiveLeave: (id) => api.post(`/api/duelo-live/${id}/leave`, undefined),
  votar: (enfrentamientoId, personajeId) =>
    // El backend espera el campo personajeGanadorId (validado con @NotNull en
    // VotoEnfrentamientoRequest); antes mandábamos personajeId y rebotaba con 400.
    api.post(`/api/enfrentamientos/${enfrentamientoId}/votar`, {
      personajeGanadorId: personajeId,
    }),
}
