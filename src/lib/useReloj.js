import { useCallback, useSyncExternalStore } from 'react'

const MINUTO = 60000

/**
 * Minuto actual (ms desde 1970, redondeado al minuto) que se renueva solo
 * mientras `activo` sea true. Sirve para cuentas atrás sin guardar la hora
 * en el estado ni pintar cada segundo.
 */
export function useMinuto(activo) {
  const suscribir = useCallback(
    (aviso) => {
      if (!activo) return () => {}
      const id = setInterval(aviso, 10000)
      return () => clearInterval(id)
    },
    [activo],
  )
  return useSyncExternalStore(suscribir, instante, instante)
}

const instante = () => Math.floor(Date.now() / MINUTO) * MINUTO
