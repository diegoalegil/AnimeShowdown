import { normalizar } from '../../lib/catalog.js'
import { Autocompletar } from './Autocompletar.jsx'
import { SERIES } from './cartas.js'

// Texto de búsqueda de cada serie (título y nombre original), precalculado.
const indice = new Map(SERIES.map((a) => [a.id, normalizar(`${a.titulo} ${a.nativo ?? ''}`)]))

const clave = (a) => a.id
const principal = (a) => a.titulo
const secundario = (a) => a.nativo

/**
 * Selector de series con sugerencias (título y nombre original). Para
 * ¿De qué serie? y cualquier juego que pida una serie como respuesta.
 *
 * Props:
 * - `onElegir(serie)`: al elegir ({ id, titulo, nativo, count, … } de catalogo.animes).
 * - `lista`: series entre las que buscar (por defecto, todas con personajes).
 * - `excluir`: Set de ids de serie que no se ofrecen.
 * - `etiqueta` ('Buscar serie'), `placeholder`, `desactivado`, `autoEnfocar`, `maximo`.
 */
export function SelectorSeries({
  onElegir,
  lista = SERIES,
  excluir,
  etiqueta = 'Buscar serie',
  placeholder = 'Título de la serie',
  ...resto
}) {
  const buscar = (consulta) => {
    const palabras = normalizar(consulta).split(' ').filter(Boolean)
    return lista.filter((a) => {
      if (excluir?.has(a.id)) return false
      const texto = indice.get(a.id) ?? normalizar(`${a.titulo} ${a.nativo ?? ''}`)
      return palabras.every((p) => texto.includes(p))
    })
  }
  return (
    <Autocompletar
      buscar={buscar}
      clave={clave}
      principal={principal}
      secundario={secundario}
      onElegir={onElegir}
      etiqueta={etiqueta}
      placeholder={placeholder}
      vacio="Ninguna serie coincide."
      {...resto}
    />
  )
}
