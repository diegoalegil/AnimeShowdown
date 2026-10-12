// Todo lo que un juego necesita, desde un solo sitio:
//   import { MarcoJuego, ResultadoRonda, terminarRonda, … } from '../comun/index.js'
export { MarcoJuego } from './MarcoJuego.jsx'
export { ResultadoRonda } from './ResultadoRonda.jsx'
export { BuscadorPersonajes } from './BuscadorPersonajes.jsx'
export { SelectorSeries } from './SelectorSeries.jsx'
export { Autocompletar } from './Autocompletar.jsx'
export { Proximamente } from './Proximamente.jsx'
export { terminarRonda, sobresExtraPorAbrir } from './recompensa.js'
export { useProgreso, useProgresoJuego } from './useProgreso.js'
export { SIN_JUGAR } from './progreso.js'
export {
  barajar,
  crearAzar,
  elegirDeSeriesDistintas,
  elegirUno,
  elegirVarios,
  entero,
  enteroEntre,
  mezclarOpciones,
  semillaDe,
} from './azar.js'
export {
  PERSONAJES,
  SERIES,
  conPopularidad,
  grupoDeUnaSerie,
  personajeAlAzar,
  personajesDeSerie,
  personajesDeSeriesDistintas,
  popularidad,
  serieDe,
  seriesConAlMenos,
} from './cartas.js'
// Lo de siempre en la web, reexportado para no cruzar carpetas.
export { Carta } from '../../components/Carta.jsx'
export { Enlace } from '../../components/Enlace.jsx'
export { Hanko } from '../../components/Hanko.jsx'
export { EtiquetaVertical } from '../../components/EtiquetaVertical.jsx'
export { catalogo, esEspecial, normalizar, numeroCarta } from '../../lib/catalog.js'
export { imagenCarta } from '../../lib/images.js'
export { movimientoReducido } from '../../lib/motion.js'
export { diaLocal } from '../../lib/collection.js'
export { nombreCarta } from '../../lib/titulos.js'
