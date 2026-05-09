import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { endpoints, setToken, ApiError } from '../lib/api'

const AuthContext = createContext(null)
const STORAGE_KEY = 'animeshowdown.user'

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

  const login = async (email, password) => {
    try {
      const res = await endpoints.login({ email, password })
      if (res?.token) setToken(res.token)
      const nombre = res?.usuario?.nombre || email.split('@')[0]
      setUser({ email, nombre, ...(res?.usuario || {}) })
      toast.success(`Bienvenido, ${nombre}`, {
        description: 'Sesión iniciada correctamente.',
      })
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        toast.error('Credenciales inválidas', {
          description: 'Revisa el email y contraseña.',
        })
        throw err
      }
      // Fallback demo si el backend no responde
      const nombre = email.split('@')[0]
      setUser({ email, nombre })
      toast.success(`Bienvenido, ${nombre}`, {
        description: 'Modo demo (backend no disponible).',
      })
    }
  }

  const register = async ({ email, password, nombre }) => {
    try {
      const res = await endpoints.register({ email, password, nombre })
      if (res?.token) setToken(res.token)
      const nombreFinal = res?.usuario?.nombre || nombre
      setUser({ email, nombre: nombreFinal, ...(res?.usuario || {}) })
      toast.success(`Cuenta creada, ${nombreFinal}`, {
        description: 'Bienvenido a AnimeShowdown.',
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Email ya registrado', {
          description: 'Inicia sesión o usa otro email.',
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
      setUser({ email, nombre })
      toast.success(`Cuenta creada, ${nombre}`, {
        description: 'Modo demo (backend no disponible).',
      })
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    toast('Hasta pronto', { description: 'Sesión cerrada.' })
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
