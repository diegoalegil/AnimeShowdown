import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { endpoints, setToken, refreshSession, ApiError } from '../lib/api'
import { playMagic } from '../lib/sounds'

const AuthContext = createContext(null)
const STORAGE_KEY = 'animeshowdown.user'

/**
 * Plan v2 §1.3 — sesión persistente vía refresh cookie httpOnly:
 *
 *   1. Al montar, llamamos refreshSession() — el backend intenta rotar el
 *      refresh_token cookie (si existe) y devuelve un JWT corto + datos
 *      del usuario. Si funciona, el usuario queda logueado sin volver
 *      a pedirle pass.
 *   2. login/register guardan el JWT en memoria (api.js) y persisten
 *      una copia ligera del user en localStorage (solo para UX:
 *      enseñar el avatar antes del primer refresh). El JWT NO va a
 *      localStorage — protegido contra XSS.
 *   3. logout llama POST /api/auth/logout para que el backend revoque
 *      la entrada y limpie la cookie del navegador.
 */

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
    // Carga optimista del localStorage para evitar flash de "invitado" antes
    // de que termine el primer refresh. Si el refresh falla luego, este
    // estado se limpia.
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Bootstrap del refresh al montar. Si la cookie está viva, conseguimos
  // un JWT fresco y mantenemos la sesión. Si no, el user optimista se
  // limpia y aparece como invitado.
  useEffect(() => {
    let cancelled = false
    refreshSession().then((data) => {
      if (cancelled) return
      if (data?.token && data.usuario) {
        // refreshSession ya pone el token en memoria; solo actualizamos el user.
        setUser(buildLocalUser(data.usuario))
      } else if (user) {
        // Había user optimista pero el refresh falló → la cookie ya no es
        // válida. Forzamos logout local.
        setUser(null)
      }
    })
    return () => {
      cancelled = true
    }
    // Solo al montar. Si user cambia más tarde no queremos re-disparar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  // Helper interno: aplica el resultado de un login exitoso (token + user)
  // a la sesión local. Se llama tanto desde login() sin 2FA como desde
  // completeLogin2fa() tras superar el segundo paso.
  const aplicarSesion = (res, identificadorFallback) => {
    if (res?.token) setToken(res.token)
    const u =
      buildLocalUser(res?.usuario) || {
        username: identificadorFallback,
        email: identificadorFallback?.includes('@') ? identificadorFallback : null,
        rol: 'USER',
      }
    setUser(u)
    const muted = localStorage.getItem('animeshowdown.muted') === 'true'
    if (!muted) playMagic()
    toast.success(`Bienvenido, ${u.username}`, {
      description:
        u.rol === 'ADMIN' ? 'Sesión ADMIN iniciada.' : 'Sesión iniciada.',
    })
    return u
  }

  /**
   * Inicia sesión. Si el usuario tiene 2FA activo, el backend NO devuelve
   * token sino { requires2fa, challengeToken, expiraEnSegundos } y aquí
   * devolvemos ese mismo objeto al caller para que pinte el segundo paso.
   * En el caso normal sin 2FA aplicamos la sesión y devolvemos null.
   */
  const login = async (identificador, password) => {
    try {
      const res = await endpoints.login({
        username: identificador,
        password,
      })
      if (res?.requires2fa) {
        // No tocamos token ni user — el flujo se queda pausado hasta que
        // el caller complete con completeLogin2fa.
        return {
          requires2fa: true,
          challengeToken: res.challengeToken,
          expiraEnSegundos: res.expiraEnSegundos,
          identificador,
        }
      }
      aplicarSesion(res, identificador)
      return null
    } catch (err) {
      const { title, description } = describeError(err)
      toast.error(title, { description })
      throw err
    }
  }

  /** Completa el paso 2 del login con 2FA. Devuelve el usuario logueado. */
  const completeLogin2fa = async (challengeToken, codigo, identificador) => {
    const res = await endpoints.verifyLogin2fa(challengeToken, codigo)
    return aplicarSesion(res, identificador)
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

  const logout = async () => {
    // Notificamos al backend para revocar el refresh y limpiar la cookie.
    // Si falla la red lo loggeamos pero seguimos limpiando local — el
    // usuario espera que "Cerrar sesión" funcione siempre.
    try {
      await endpoints.logout()
    } catch (err) {
      // ignore: revocación best-effort; el JWT en memoria se va a la papelera.
      console.debug('logout backend falló (ignored):', err?.message)
    }
    setUser(null)
    setToken(null)
    toast('Hasta pronto', { description: 'Sesión cerrada.' })
  }

  return (
    <AuthContext.Provider
      value={{ user, login, completeLogin2fa, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
