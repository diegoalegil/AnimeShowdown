// Producción usa el subdominio custom api.animeshowdown.dev (CNAME a Railway).
// Si por algún motivo el subdominio no resuelve, fallback al URL bruto de Railway
// para que la app no quede sin backend.
const API_BASE =
  import.meta.env.VITE_API_URL ??
  'https://api.animeshowdown.dev'

// Plan v2 §1.3: el JWT vive en MEMORIA, no en localStorage. La sesión
// persistente la da el refresh_token cookie httpOnly que pone el backend
// — esa cookie no la pueden tocar scripts (defensa XSS) y solo viaja a
// nuestro propio dominio en peticiones credentialed (defensa CSRF).
//
// Bootstrap: al abrir la app, AuthContext llama refreshSession() para
// intentar conseguir un JWT fresco usando la cookie persistente. Si éxito
// el usuario sigue logueado; si fallo aparece como invitado.
let tokenEnMemoria = null
// One-shot: si la versión anterior dejó tokens en localStorage, los borramos
// la primera vez que se importa este módulo. Es migración invisible para el
// user — la próxima vez que abra la web ya no hay rastros del modelo viejo.
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('animeshowdown.token')
  }
} catch {
  // ignore (SSR / privacy mode)
}

export function getToken() {
  return tokenEnMemoria
}

export function setToken(token) {
  tokenEnMemoria = token || null
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

async function intentarRefresh() {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        tokenEnMemoria = null
        return null
      }
      const data = await res.json()
      if (data?.token) {
        tokenEnMemoria = data.token
      }
      return data
    } catch {
      tokenEnMemoria = null
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
  const fullHeaders = { 'Content-Type': 'application/json', ...headers }
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

    // Auto-refresh on 401: si la petición autenticada falla con 401, intenta
    // /refresh una vez. Si el refresh funciona, reintenta la petición original
    // con el nuevo token. Si el refresh falla, propaga el 401 original.
    // Excluimos los propios endpoints /auth/login y /auth/refresh para no
    // entrar en bucle.
    const esRutaAuth =
      path.includes('/api/auth/refresh') ||
      path.includes('/api/auth/login') ||
      path.includes('/api/auth/registro')
    if (res.status === 401 && auth && !esRutaAuth) {
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
  logros: () => api.get('/api/logros', { auth: false }),
  misLogros: () => api.get('/api/logros/mios'),
  // Reactions (Plan v2 §4.3).
  //   getReacciones: público, devuelve {counts, miReaccion, total}.
  //   aplicarReaccion: autenticado. Backend gestiona toggle/swap automático.
  getReacciones: (targetType, targetId) =>
    api.get(
      `/api/reacciones?targetType=${targetType}&targetId=${targetId}`,
    ),
  aplicarReaccion: ({ targetType, targetId, tipo }) =>
    api.post('/api/reacciones', { targetType, targetId, tipo }),
  me: () => api.get('/api/auth/me'),
  updateAvatar: (avatarUrl) => api.put('/api/auth/me/avatar', { avatarUrl }),
  changePassword: (currentPassword, newPassword) =>
    api.put('/api/auth/me/password', { currentPassword, newPassword }),
  personajes: () => api.get('/api/personajes'),
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
  // Match aleatorio abierto (Plan v2 §1.1). Devuelve EnfrentamientoDto o
  // 404 (modo casual del frontend toma el control). No requiere auth.
  enfrentamientoAleatorio: () => api.get('/api/enfrentamientos/aleatorio', { auth: false }),
  votar: (enfrentamientoId, personajeId) =>
    // El backend espera el campo personajeGanadorId (validado con @NotNull en
    // VotoEnfrentamientoRequest); antes mandábamos personajeId y rebotaba con 400.
    api.post(`/api/enfrentamientos/${enfrentamientoId}/votar`, {
      personajeGanadorId: personajeId,
    }),
}
