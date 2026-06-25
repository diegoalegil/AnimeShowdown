import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { toast } from 'sonner'
import {
  endpoints,
  setToken,
  setSesionEsperada,
  refreshSession,
  setLoggingOut,
  bumpSessionEpoch,
  ApiError,
} from '../lib/api'
import { playMagic } from '../lib/sounds'
import { queryClient } from '../lib/queryClient'
import { hydrateDailyFromServer } from '../lib/dailyProgress'

const AuthContext = createContext(null)
const STORAGE_KEY = 'animeshowdown.user'

function disconnectRealtime() {
  return import('../lib/stomp')
    .then(({ disconnect }) => disconnect())
    .catch((err) => {
      if (import.meta.env.DEV) {
        console.debug('realtime disconnect falló (ignored):', err?.message)
      }
    })
}

/**
 * 3 — sesión persistente vía refresh cookie httpOnly:
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
  // Antes solo persistíamos id/username/email/
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
    // B7 §1a: bio pública editable. Puede venir null (usuario sin bio).
    bio: payload.bio ?? null,
    rol: payload.rol || 'USER',
    estadoVerificacion: payload.estadoVerificacion || 'PENDIENTE',
    totpHabilitado: payload.totpHabilitado === true,
    // V-8: true mientras el usuario (típicamente OAuth con username
    // autogenerado) no haya pasado/saltado el onboarding. Dispara el
    // OnboardingModal una vez. Se refresca desde /me en cada bootstrap.
    needsOnboarding: payload.needsOnboarding === true,
    // V72: marco de avatar equipado (cosmético coin-sink). null = ninguno.
    // Avatar.jsx lo lee para pintar el aro/aura del usuario propio.
    marcoAvatar: payload.marcoAvatar ?? null,
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

  // Mantiene en sync el cliente API: si hay usuario (optimista o confirmado),
  // se ESPERA una sesión, así una petición /me en carga fría sin token todavía
  // espera al /refresh del bootstrap antes de disparar (evita el 403 de carrera
  // que dejaba datos viejos, p.ej. el banner del sobre de bienvenida). Va en el
  // cuerpo del render (antes que los efectos de los hijos que disparan queries)
  // a propósito; es un set idempotente de un flag de módulo, no estado React.
  setSesionEsperada(Boolean(user))

  // Bootstrap del refresh al montar.
  //
  // Antes este efecto saltaba el refresh
  // si `!user` (sin entry en localStorage). Eso rompía la sesión persistente
  // en cualquier caso de usuario que TENÍA refresh cookie httpOnly válida
  // pero NO tenía el user cacheado en localStorage:
  //   - Cambio de dispositivo (cookie viajó pero localStorage es por device)
  //   - Limpieza manual de "Site data" en el navegador
  //   - Modo privado/incógnito tras login previo (no debería persistir pero
  //     algunas integraciones sí)
  //   - Storage quota corrupta o cleanup automático del SO
  // El síntoma: usuario aparecía como invitado aunque la cookie httpOnly
  // siguiera viva en el browser, y el backend habría devuelto un JWT fresh
  // si lo hubiéramos pedido.
  //
  // Ahora intentamos refresh SIEMPRE en el bootstrap. Cuesta 1 POST extra
  // por sesión anónima (el backend responde 401 sin tocar DB si no hay
  // cookie), a cambio de respetar la cookie como fuente de verdad.
  useEffect(() => {
    let cancelled = false
    refreshSession()
      .then((data) => {
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
        // Si !user y refresh falla, estado correcto (invitado): no-op.
      })
      .catch(() => {
        // Error de red o 5xx — mantenemos el user optimista si lo había.
        // Un 401 limpio ya se resuelve dentro de refreshSession devolviendo
        // null, así que esta rama es solo para fallos inesperados.
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

  // Al iniciar sesión (o validarla por refresh), tira del progreso diario y la
  // racha del servidor: la verdad server-side (#1) sana un localStorage limpiado
  // y sincroniza entre dispositivos. Best-effort: no bloquea ni rompe nada.
  useEffect(() => {
    if (user) hydrateDailyFromServer()
  }, [user])

  // Helper interno: aplica el resultado de un login exitoso (token + user)
  // a la sesión local. Se llama tanto desde login() sin 2FA como desde
  // completeLogin2fa() tras superar el segundo paso.
  const aplicarSesion = useCallback((res, identificadorFallback) => {
    if (res?.token) {
      // Bump epoch ANTES de setToken para
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
    // Limpia el cache de queries ANTES de cambiar
    // user. Si el navegador venía con sesión de otro usuario (kiosko,
    // logout incompleto, dispositivo compartido), las queries privadas
    // cacheadas — perfil, notificaciones, "mis torneos", logros — se
    // mostrarían un instante hasta que stale-time las refresque. Limpiar
    // garantiza que la próxima ronda de queries vuelve a hacer fetch
    // con el nuevo JWT.
    queryClient.clear()
    setUser(u)
    endpoints.migrarVotosAnonimos()
      .then((res) => {
        if (res?.migrados > 0) {
          toast.success('Votos invitados guardados', {
            description: `${res.migrados} votos aparecen ya en tu historial.`,
          })
        }
      })
      .catch(() => {})
    const muted = localStorage.getItem('animeshowdown.muted') === 'true'
    // playMagic es async (nota de rendimiento 2026-05-18); silenciamos posible rejection.
    if (!muted) playMagic().catch(() => {})
    toast.success(`Bienvenido, ${u.username}`, {
      description:
        u.rol === 'ADMIN' ? 'Sesión ADMIN iniciada.' : 'Sesión iniciada.',
    })
    return u
  }, [])

  /**
   * Inicia sesión. Si el usuario tiene 2FA activo, el backend NO devuelve
   * token sino { requires2fa, challengeToken, expiraEnSegundos } y aquí
   * devolvemos ese mismo objeto al caller para que pinte el segundo paso.
   * En el caso normal sin 2FA aplicamos la sesión y devolvemos null.
   */
  const login = useCallback(async (identificador, password) => {
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
  }, [aplicarSesion])

  /** Completa el paso 2 del login con 2FA. Devuelve el usuario logueado. */
  const completeLogin2fa = useCallback(
    async (challengeToken, codigo, identificador) => {
      const res = await endpoints.verifyLogin2fa(challengeToken, codigo)
      return aplicarSesion(res, identificador)
    },
    [aplicarSesion],
  )

  /**
   * Finaliza un login externo (Google/Discord). El backend ya dejó la
   * refresh cookie httpOnly en el callback OAuth; aquí solo pedimos un JWT
   * corto vía /refresh y aplicamos la sesión al estado React.
   */
  const finalizeOAuthLogin = useCallback(async () => {
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
  }, [aplicarSesion])

  const register = useCallback(
    async ({ username, email, password, referralCode }) => {
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
    },
    [login],
  )

  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev))
  }, [])

  /**
   * V-8: cambia el username del usuario logueado. El backend devuelve un JWT
   * fresco porque el subject del JWT es el username — sin reemplazarlo en
   * memoria, el access token actual apuntaría a un username inexistente y la
   * sesión caería en 401 hasta el siguiente refresh. Bumpeamos epoch + setToken
   * igual que aplicarSesion para invalidar cualquier refresh en vuelo, y
   * marcamos needsOnboarding=false (el cambio cierra el paso de onboarding).
   */
  const changeUsername = useCallback(async (username) => {
    const res = await endpoints.changeUsername(username)
    if (res?.token) {
      bumpSessionEpoch()
      setToken(res.token)
    }
    const nuevoUsername = res?.usuario?.username || username
    updateUser({ username: nuevoUsername, needsOnboarding: false })
    return nuevoUsername
  }, [updateUser])

  /**
   * B7 §1a: actualiza la bio pública. El backend la sanitiza (texto plano,
   * máx 240) y devuelve el UsuarioRespuesta con la bio ya normalizada;
   * reflejamos ese valor en el estado local. Devuelve la bio guardada.
   */
  const changeBio = useCallback(async (bio) => {
    const res = await endpoints.changeBio(bio)
    const nuevaBio = res?.bio ?? null
    updateUser({ bio: nuevaBio })
    return nuevaBio
  }, [updateUser])

  /**
   * V-8: marca el onboarding como visto sin tocar username ni avatar
   * ("Saltar por ahora"). Best-effort: si la red falla cerramos igualmente el
   * modal en local; el flag del backend se reintenta en el siguiente cambio.
   */
  const skipOnboarding = useCallback(async () => {
    try {
      await endpoints.skipOnboarding()
    } catch {
      // best-effort: el modal se cierra igual con el updateUser de abajo.
    }
    updateUser({ needsOnboarding: false })
  }, [updateUser])

  const logout = useCallback(async () => {
    // Marca isLoggingOut ANTES de pegar
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
        if (import.meta.env.DEV) {
          console.debug('logout backend falló (ignored):', err?.message)
        }
      }
      // Vacía el cache de React Query antes de
      // limpiar el user. Sin esto, queries privadas (perfil, notificaciones,
      // mis torneos, logros) quedan en cache; si el siguiente usuario hace
      // login en el mismo navegador, las verá un instante hasta que
      // stale-time refresque. Equivalente a invalidar toda la caché privada.
      queryClient.clear()
      // Cierra el WS singleton.
      void disconnectRealtime()
      setUser(null)
      setToken(null)
      toast('Hasta pronto', { description: 'Sesión cerrada.' })
    } finally {
      setLoggingOut(false)
    }
  }, [])

  // Memoizamos el value para que los consumidores de useAuth no se
  // re-rendericen en cada render del provider. Las funciones son estables
  // (useCallback), así que el objeto solo cambia cuando cambia `user`.
  const value = useMemo(
    () => ({
      user,
      login,
      completeLogin2fa,
      finalizeOAuthLogin,
      register,
      logout,
      updateUser,
      changeUsername,
      changeBio,
      skipOnboarding,
    }),
    [
      user,
      login,
      completeLogin2fa,
      finalizeOAuthLogin,
      register,
      logout,
      updateUser,
      changeUsername,
      changeBio,
      skipOnboarding,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
