// Marcos de avatar (cosmético coin-sink). Fuente de verdad del LOOK en el
// frontend: mapea el id del marco (lo que el backend dice que tienes/equipas)
// a la clase CSS del aro (ver components/marcos.css). El backend decide
// posesión/precio; el aspecto vive aquí, reutilizando los tokens de color.

export const MARCO_CLASS = {
  bronce: 'marco-bronce',
  plata: 'marco-plata',
  oro: 'marco-oro',
  cian: 'marco-cian',
  carmesi: 'marco-carmesi',
  prismatico: 'marco-prismatico',
}

/** Clase CSS del aro para un id de marco, o null si no hay/!existe. */
export function marcoClass(id) {
  return id ? MARCO_CLASS[id] || null : null
}
