import { lazy } from 'react'

/**
 * Página que se descarga aparte del código inicial. Si ya se precargó, se
 * pinta en el acto, sin pasar por el Suspense: así la View Transition al
 * entrar captura la página de verdad y no el marcador de carga.
 *
 * `precargar` puede llamarse cuando el navegador esté libre.
 */
export function diferido(importar) {
  let modulo = null
  let promesa = null
  // Si la descarga falla (p. ej. sin red un momento), se olvida la promesa
  // fallida: el siguiente intento vuelve a pedir el módulo.
  const precargar = () => {
    promesa ??= importar().then(
      (m) => (modulo = m),
      (error) => {
        promesa = null
        throw error
      },
    )
    return promesa
  }
  // React.lazy espera una promesa; con el módulo ya en memoria se le da un
  // «thenable» que responde al momento y el componente no llega a suspenderse.
  const Componente = lazy(() => (modulo ? { then: (listo) => listo(modulo) } : precargar()))
  return { Componente, precargar }
}

/** Ejecuta `tarea` cuando el navegador esté libre (o al poco, si no sabe decirlo). */
export function cuandoLibre(tarea) {
  if (typeof window === 'undefined') return
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(tarea, { timeout: 4000 })
  else setTimeout(tarea, 1500)
}
