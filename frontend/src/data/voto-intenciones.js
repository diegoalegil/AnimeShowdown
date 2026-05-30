/**
 * Catálogo de intenciones de voto (feature #15): el "por qué" opcional de un
 * voto en un duelo. Lista CERRADA, en lockstep 1:1 con el enum backend
 * `CategoriaVoto.java` — los `id` son los mismos valores de wire (kebab) que
 * viajan en la API/URL y se persisten en `votos.categoria`. Un test de drift
 * (`voto-intenciones.test.js`) verifica que no se desincronicen.
 *
 * Mismo shape que `CATEGORIAS` en personajes-tags.js ({id, label, emoji, tono})
 * para reusar el estilo de chips/pills. Es la fuente de identidad (REGLA #7)
 * del selector y del sub-ranking por intención: cada categoría lleva su emoji y
 * su tono propios, nunca un pill genérico.
 *
 * OJO conceptual: estas intenciones (por qué votó la gente) NO son los
 * arquetipos de personaje de personajes-tags.js (qué ES el personaje). Son
 * dos ejes distintos y la UI los rotula por separado.
 */
export const INTENCIONES = [
  { id: 'poder', label: 'Poder', emoji: '💥', tono: 'orange' },
  { id: 'diseno', label: 'Diseño', emoji: '🎨', tono: 'violet' },
  { id: 'carisma', label: 'Carisma', emoji: '✨', tono: 'amber' },
  { id: 'mejor-escrito', label: 'Mejor escrito', emoji: '📖', tono: 'sky' },
  { id: 'mejor-villano', label: 'Mejor villano', emoji: '😈', tono: 'rose' },
  { id: 'favorito', label: 'Favorito', emoji: '❤️', tono: 'pink' },
]

/** Lookup por id de wire → intención. */
export const INTENCIONES_BY_ID = Object.fromEntries(
  INTENCIONES.map((intencion) => [intencion.id, intencion]),
)

/** Etiqueta legible de una intención por su id (fallback al propio id). */
export function labelIntencion(id) {
  return INTENCIONES_BY_ID[id]?.label ?? id
}
