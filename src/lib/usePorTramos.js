import { startTransition, useEffect, useState } from 'react'

/**
 * Monta una lista larga por tramos: primero `primero` elementos (lo que cabe
 * en pantalla) y después `tramo` más cada `pausa` ms, en segundo plano y mucho
 * antes de que dé tiempo a llegar con el scroll. Montar mil cartas de golpe
 * bloquea un móvil unos 200 ms.
 *
 * Si la lista cambia (filtros nuevos) se vuelve a empezar por el primer tramo.
 * Con `completa` se monta todo desde el principio (p. ej. al volver atrás,
 * para recuperar la posición del scroll).
 */
export function usePorTramos(lista, { primero, tramo, pausa = 32, completa = false }) {
  const [estado, setEstado] = useState(() => ({ lista, limite: completa ? Infinity : primero }))
  let limite = estado.limite
  if (estado.lista !== lista) {
    limite = primero
    setEstado({ lista, limite })
  }
  const faltan = limite < lista.length

  useEffect(() => {
    if (!faltan) return undefined
    const temporizador = setTimeout(() => {
      startTransition(() => setEstado((e) => ({ ...e, limite: e.limite + tramo })))
    }, pausa)
    return () => clearTimeout(temporizador)
  }, [faltan, limite, tramo, pausa])

  return faltan ? lista.slice(0, limite) : lista
}
