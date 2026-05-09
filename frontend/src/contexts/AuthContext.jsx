import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { endpoints, setToken, ApiError } from '../lib/api'
import { playMagic } from '../lib/sounds'

const AuthContext = createContext(null)
const STORAGE_KEY = 'animeshowdown.user'

function buildLocalUser(payload) {
  if (!payload) return null
  return {
    id: payload.id,
    username: payload.username,
    email: payload.email,
    avatarUrl: payload.avatarUrl,
    rol: payload.rol || 'USER',
  }
}

function describeError(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return {
        title: 'Credenciales inválidas',
        description: 'Revisa tu username/email y contraseña.',
      }
    }
    if (err.status === 409) {
      return {
        title: 'Usuario o email ya registrado',
        description: 'Prueba con otros datos o entra desde Login.',
      }
    }
    if (err.status >= 400 && err.status < 500) {
      return {
        title: 'Datos inválidos',
        description: err.message || 'Revisa los campos del formulario.',
      }
    }
    return {
      title: 'Error en el servidor',
      description: `${err.status} · ${err.message || 'Inténtalo en unos segundos.'}`,
    }
  }
  return {
    title: 'No se pudo conectar al servidor',
    description: 'Verifica tu conexión o inténtalo en unos segundos.',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  const login = async (identificador, password) => {
    try {
      const res = await endpoints.login({
        username: identificador,
        password,
      })
      if (res?.token) setToken(res.token)
      const u =
        buildLocalUser(res?.usuario) || {
          username: identificador,
          email: identificador.includes('@') ? identificador : null,
          rol: 'USER',
        }
      setUser(u)
      const muted = localStorage.getItem('animeshowdown.muted') === 'true'
      if (!muted) playMagic()
      toast.success(`Bienvenido, ${u.username}`, {
        description:
          u.rol === 'ADMIN' ? 'Sesión ADMIN iniciada.' : 'Sesión iniciada.',
      })
    } catch (err) {
      const { title, description } = describeError(err)
      toast.error(title, { description })
      throw err
    }
  }

  const register = async ({ username, email, password }) => {
    try {
      await endpoints.register({ username, email, password })
      // Backend register no devuelve token; hacemos login automático con username + password
      await login(username, password)
    } catch (err) {
      const { title, description } = describeError(err)
      toast.error(title, { description })
      throw err
    }
  }

  const updateUser = (partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    toast('Hasta pronto', { description: 'Sesión cerrada.' })
  }

  return (
    <AuthContext.Provider
      value={{ user, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
