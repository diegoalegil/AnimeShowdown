// Producción usa el subdominio custom api.animeshowdown.dev (CNAME a Railway).
// Si por algún motivo el subdominio no resuelve, fallback al URL bruto de Railway
// para que la app no quede sin backend.
const API_BASE =
  import.meta.env.VITE_API_URL ??
  'https://api.animeshowdown.dev'

const TOKEN_KEY = 'animeshowdown.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    // ignore storage errors
  }
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

async function request(
  path,
  { method = 'GET', body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {},
) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  // Si el caller pasa su propio signal lo respetamos; si no, montamos un
  // AbortController interno con el timeout configurado. Esto permite cancelar
  // requests desde useEffect cleanup (evita setState en componentes
  // desmontados) y cortar las que tarden más de lo razonable.
  const controller = signal ? null : new AbortController()
  const effectiveSignal = signal ?? controller.signal
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: effectiveSignal,
    })
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
  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (data) =>
    api.post('/api/auth/reset-password', data, { auth: false }),
  me: () => api.get('/api/auth/me'),
  updateAvatar: (avatarUrl) => api.put('/api/auth/me/avatar', { avatarUrl }),
  changePassword: (currentPassword, newPassword) =>
    api.put('/api/auth/me/password', { currentPassword, newPassword }),
  personajes: () => api.get('/api/personajes'),
  personaje: (id) => api.get(`/api/personajes/${id}`),
  createPersonaje: (data) => api.post('/api/personajes', data),
  deletePersonaje: (id) => api.del(`/api/personajes/${id}`),
  torneos: () => api.get('/api/torneos'),
  torneo: (id) => api.get(`/api/torneos/${id}`),
  createTorneo: (data) => api.post('/api/torneos', data),
  // deleteTorneo eliminado: TorneoController no expone @DeleteMapping todavía,
  // si el frontend lo llamaba caía con 405. Se restaurará cuando se implemente backend-side.
  ranking: () => api.get('/api/votos/ranking'),
  votar: (enfrentamientoId, personajeId) =>
    // El backend espera el campo personajeGanadorId (validado con @NotNull en
    // VotoEnfrentamientoRequest); antes mandábamos personajeId y rebotaba con 400.
    api.post(`/api/enfrentamientos/${enfrentamientoId}/votar`, {
      personajeGanadorId: personajeId,
    }),
}
