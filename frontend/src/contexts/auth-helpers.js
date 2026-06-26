import { ApiError } from '../lib/api'

/**
 * Normaliza el payload de usuario (login/refresh) a la forma ligera que vive en
 * el estado de AuthContext + localStorage.
 *
 * Extraído de AuthContext para poder testearlo aislado: los defaults de aquí
 * han causado bugs reales (faltaba estadoVerificacion → el banner de
 * verificación asumía PENDIENTE; faltaba totpHabilitado → la card de 2FA
 * pintaba desactivado aunque el usuario lo tuviera). El test pinea cada default.
 */
export function buildLocalUser(payload) {
  if (!payload) return null
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
    marcoAvatar: payload.marcoAvatar ?? null,
  }
}

/**
 * Traduce un error de auth (login/registro) al copy que ve el usuario en el
 * embudo. Mapea por status: 401 credenciales, 409 ya registrado, otros 4xx
 * datos inválidos, 5xx error de servidor, y sin ApiError = fallo de red.
 */
export function describeError(err) {
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
