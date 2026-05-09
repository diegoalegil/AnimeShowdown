import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'

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

  const login = async (email) => {
    await new Promise((r) => setTimeout(r, 600))
    const nombre = email.split('@')[0]
    setUser({ email, nombre })
    toast.success(`Bienvenido, ${nombre}`, {
      description: 'Sesión iniciada correctamente.',
    })
  }

  const register = async ({ email, nombre }) => {
    await new Promise((r) => setTimeout(r, 700))
    setUser({ email, nombre })
    toast.success(`Cuenta creada, ${nombre}`, {
      description: 'Bienvenido a AnimeShowdown.',
    })
  }

  const logout = () => {
    setUser(null)
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
