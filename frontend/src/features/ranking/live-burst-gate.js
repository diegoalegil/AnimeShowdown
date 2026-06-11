/**
 * Gate de actualización masiva del odómetro de la tabla viva.
 *
 * Un voto por WS cambia uno o dos números; el refetch de 60s o el recálculo
 * del ELO canónico cambian decenas en el mismo commit. Si cada LiveNumber
 * rodara y soltara su «+N» a la vez, la tabla entera parpadea (ruido, no
 * señal) y se quema main thread. Cada cambio se apunta aquí y la decisión de
 * animar se toma tras un microtask, cuando el ciclo ya contó TODOS los
 * cambios del commit: por encima del umbral los números saltan directos.
 */

// Mismo orden de magnitud que MAX_ANIMATED_SHIFTS de useFlipList pero más
// estricto: una docena de «+N» simultáneos ya no se lee como señal.
export const MAX_ANIMATED_CHANGES_PER_CYCLE = 12

let activeCycle = null

/**
 * Registra un cambio en el ciclo actual (abre uno si no hay) y devuelve el
 * objeto del ciclo. Los efectos del mismo commit corren en la misma tarea,
 * así que `cycle.count` leído tras un microtask es el total del ciclo. El
 * ciclo se cierra solo, también por microtask; los registros conservan su
 * referencia, por lo que el cierre no les borra el contador.
 */
export function trackLiveChange() {
  if (!activeCycle) {
    const cycle = { count: 0 }
    activeCycle = cycle
    queueMicrotask(() => {
      if (activeCycle === cycle) activeCycle = null
    })
  }
  activeCycle.count += 1
  return activeCycle
}
