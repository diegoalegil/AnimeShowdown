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
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        toast.error('Credenciales inválidas', {
          description: 'Revisa tu email/username y contraseña.',
        })
        throw err
      }
      // Fallback demo si el backend no responde
      const fakeUser = {
        username: identificador,
        email: identificador.includes('@') ? identificador : null,
        rol: 'USER',
      }
      setUser(fakeUser)
      toast.success(`Bienvenido, ${fakeUser.username}`, {
        description: 'Modo demo (backend no disponible).',
      })
    }
  }

  const register = async ({ username, email, password }) => {
    try {
      await endpoints.register({ username, email, password })
      // Backend register no devuelve token; hacemos login automático
      await login(username, password)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Usuario o email ya registrado', {
          description: 'Prueba con otro username o entra desde Login.',
        })
        throw err
      }
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        toast.error('Datos inválidos', {
          description: err.message || 'Revisa los campos del formulario.',
        })
        throw err
      }
      // Fallback demo
      const fakeUser = { username, email, rol: 'USER' }
      setUser(fakeUser)
      toast.success(`Cuenta creada, ${username}`, {
        description: 'Modo demo (backend no disponible).',
      })
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
