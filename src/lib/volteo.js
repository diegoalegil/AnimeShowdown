// Estado del volteo de la carta en la ficha: dos caras (0 y 1) y un número de
// medias vueltas. Se ve la cara giro % 2. Cambiar a otra versión del mismo
// personaje pone la carta nueva en la cara oculta y da media vuelta
// (`girando` hasta que termina la animación); pasar a otro personaje cambia
// la cara visible sin girar.

/** Estado inicial: la carta a la vista y, detrás, otra versión ya cargada. */
export function volteoInicial(id, familia) {
  return { id, base: familia[0]?.id ?? id, giro: 0, girando: false, caras: [id, otraVersion(id, familia)] }
}

/** Siguiente estado al mostrar `id`; devuelve el mismo objeto si no cambia. */
export function volteoHacia(estado, id, familia) {
  if (estado.id === id) return estado
  const base = familia[0]?.id ?? id
  const visible = estado.giro % 2
  if (estado.base !== base) {
    const caras = [id, id]
    caras[1 - visible] = otraVersion(id, familia)
    return { id, base, giro: estado.giro, girando: false, caras }
  }
  const caras = [...estado.caras]
  caras[1 - visible] = id
  return { id, base, giro: estado.giro + 1, girando: true, caras }
}

/** Estado al terminar la media vuelta. */
export const volteoQuieto = (estado) => (estado.girando ? { ...estado, girando: false } : estado)

/** Cara (0 o 1) que se ve con un estado. */
export const caraVisible = (estado) => estado.giro % 2

function otraVersion(id, familia) {
  return familia.find((c) => c.id !== id)?.id ?? id
}
