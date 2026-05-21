import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  endpoints,
  setToken,
  refreshSession,
  setLoggingOut,
  bumpSessionEpoch,
  ApiError,
} from '../lib/api'
import { playMagic } from '../lib/sounds'
import { queryClient } from '../lib/queryClient'
import { disconnect as disconnectStomp } from '../lib/stomp'

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
  // Audit P2 (2026-05-17): antes solo persistíamos id/username/email/
  // avatarUrl/rol. Faltaban estadoVerificacion (rompía el banner de
  // EmailVerifyBanner que tenía que asumir PENDIENTE por defecto) y
  // totpHabilitado (Card2faSeguridad pintaba 2FA como desactivado
  // aunque el usuario lo tuviera puesto). Ambos vienen en el payload
  // del login y del refresh — no hay coste en propagarlos al estado.
  return {
    id: payload.id,
    username: payload.username,
    email: payload.email,
    avatarUrl: payload.avatarUrl,
    rol: payload.rol || 'USER',
    estadoVerificacion: payload.estadoVerificacion || 'PENDIENTE',
    totpHabilitado: payload.totpHabilitado === true,
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
    if (!user) {
      return () => {
        cancelled = true
      }
    }
    refreshSession().then((data) => {
      if (cancelled) return
      if (data?.token && data.usuario) {
        // refreshSession ya pone el token vía setToken → onTokenChange
        // dispara stomp.reconnect que internamente hace tryAttachPending
        // tras await deactivate. Solo actualizamos el user aquí.
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
    if (res?.token) {
      // Audit P1 (2026-05-18, 5ª iter): bump epoch ANTES de setToken para
      // invalidar cualquier refreshPromise que pudiera estar en vuelo.
      // Si un refresh viejo resuelve tras este punto, su epoch capturado
      // no coincide y descarta el resultado sin tocar tokenEnMemoria.
      bumpSessionEpoch()
      setToken(res.token)
    }
    const u =
      buildLocalUser(res?.usuario) || {
        username: identificadorFallback,
        email: identificadorFallback?.includes('@') ? identificadorFallback : null,
        rol: 'USER',
      }
    // Audit P1 (2026-05-17): limpia el cache de queries ANTES de cambiar
    // user. Si el navegador venía con sesión de otro usuario (kiosko,
    // logout incompleto, dispositivo compartido), las queries privadas
    // cacheadas — perfil, notificaciones, "mis torneos", logros — se
    // mostrarían un instante hasta que stale-time las refresque. Limpiar
    // garantiza que la próxima ronda de queries vuelve a hacer fetch
    // con el nuevo JWT.
    queryClient.clear()
    setUser(u)
    const muted = localStorage.getItem('animeshowdown.muted') === 'true'
    // playMagic es async (audit perf 2026-05-18); silenciamos posible rejection.
    if (!muted) playMagic().catch(() => {})
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

  /**
   * Finaliza un login externo (Google/Discord). El backend ya dejó la
   * refresh cookie httpOnly en el callback OAuth; aquí solo pedimos un JWT
   * corto vía /refresh y aplicamos la sesión al estado React.
   */
  const finalizeOAuthLogin = async () => {
    try {
      const res = await refreshSession()
      if (!res?.token || !res?.usuario) {
        throw new Error('OAuth session refresh failed')
      }
      return aplicarSesion(res, res.usuario.username)
    } catch (err) {
      toast.error('No se pudo completar el acceso externo', {
        description: 'Vuelve a intentarlo o entra con email y contraseña.',
      })
      throw err
    }
  }

  const register = async ({ username, email, password, referralCode }) => {
    try {
      await endpoints.register({
        username,
        email,
        password,
        referralCode: referralCode || undefined,
      })
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
    // Audit P2 (2026-05-17, 4ª iter): marca isLoggingOut ANTES de pegar
    // al backend. Si una request paralela recibe 401 mientras logout
    // está en vuelo, intentarRefresh devolvía un refresh exitoso que
    // resucitaba la sesión que el user acababa de cerrar. Con el flag,
    // intentarRefresh devuelve null inmediato y la request queda
    // 401-final. Liberamos el flag al final (try/finally) por si el
    // logout falla y el user vuelve a usar la app sin reload.
    setLoggingOut(true)
    // Bump epoch para invalidar cualquier refreshPromise en vuelo que
    // pudiera resolver tras este punto. Sin esto, un refresh iniciado
    // antes del logout podía completar después y aplicar setToken
    // (resucitando la sesión cerrada).
    bumpSessionEpoch()
    try {
      // Notificamos al backend para revocar el refresh y limpiar la cookie.
      // Si falla la red lo loggeamos pero seguimos limpiando local — el
      // usuario espera que "Cerrar sesión" funcione siempre.
      try {
        await endpoints.logout()
      } catch (err) {
        // ignore: revocación best-effort; el JWT en memoria se va a la papelera.
        console.debug('logout backend falló (ignored):', err?.message)
      }
      // Audit P1 (2026-05-17): vacía el cache de React Query antes de
      // limpiar el user. Sin esto, queries privadas (perfil, notificaciones,
      // mis torneos, logros) quedan en cache; si el siguiente usuario hace
      // login en el mismo navegador, las verá un instante hasta que
      // stale-time refresque. Equivalente a invalidar TODO.
      queryClient.clear()
      // Audit P1 (2026-05-17): cierra el WS singleton.
      disconnectStomp()
      setUser(null)
      setToken(null)
      toast('Hasta pronto', { description: 'Sesión cerrada.' })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        completeLogin2fa,
        finalizeOAuthLogin,
        register,
        logout,
        updateUser,
      }}
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
