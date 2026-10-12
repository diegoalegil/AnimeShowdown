import { catalogo } from '../../lib/catalog.js'
import { imagenCarta } from '../../lib/images.js'
import { Autocompletar } from './Autocompletar.jsx'
import { PERSONAJES } from './cartas.js'

const clave = (c) => c.id
const principal = (c) => c.nombre
const secundario = (c) => c.anime
const miniatura = (c) => imagenCarta(c)

/**
 * Buscador de personajes con sugerencias (nombre y serie, sin tildes ni
 * mayúsculas) sobre el catálogo. Para Silueta, AniGrid y ¿De qué serie?
 *
 * Props:
 * - `onElegir(carta)`: al elegir un personaje (una carta del catálogo).
 * - `lista`: cartas entre las que buscar (por defecto, todos los personajes).
 * - `excluir`: Set de ids que no se ofrecen (p. ej. los ya probados).
 * - `etiqueta` ('Buscar personaje'), `placeholder`, `desactivado`, `autoEnfocar`, `maximo`.
 */
export function BuscadorPersonajes({
  onElegir,
  lista = PERSONAJES,
  excluir,
  etiqueta = 'Buscar personaje',
  placeholder = 'Nombre del personaje o de su serie',
  ...resto
}) {
  const buscar = (consulta) => {
    const coincidencias = catalogo.buscar(consulta, { lista })
    return excluir?.size ? coincidencias.filter((c) => !excluir.has(c.id)) : coincidencias
  }
  return (
    <Autocompletar
      buscar={buscar}
      clave={clave}
      principal={principal}
      secundario={secundario}
      miniatura={miniatura}
      onElegir={onElegir}
      etiqueta={etiqueta}
      placeholder={placeholder}
      vacio="Ningún personaje coincide."
      {...resto}
    />
  )
}
