const API_BASE =
  import.meta.env.VITE_API_URL ??
  'https://animeshowdown-production-a9f4.up.railway.app'

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

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
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
    throw new ApiError(
      (parsed && parsed.message) || res.statusText || 'Error de red',
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
  register: (data) => api.post('/api/auth/register', data, { auth: false }),
  personajes: () => api.get('/api/personajes'),
  personaje: (id) => api.get(`/api/personajes/${id}`),
  torneos: () => api.get('/api/torneos'),
  torneo: (id) => api.get(`/api/torneos/${id}`),
  ranking: () => api.get('/api/ranking'),
  votar: (enfrentamientoId, personajeId) =>
    api.post(`/api/enfrentamientos/${enfrentamientoId}/votar`, { personajeId }),
}
