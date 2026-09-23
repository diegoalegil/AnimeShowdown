// La ceremonia de abrir un sobre, como estado puro: qué fase se ve, qué
// cartas están boca arriba y qué se anuncia a los lectores de pantalla.
// Las cartas ya están guardadas en la colección cuando empieza (ver
// coleccion.abrirSobre); esto solo decide cómo se enseñan.
//
// Fases:
//   cerrado    el sobre espera a que lo abran
//   abriendo   se rasga el envoltorio y las cartas vuelan a su sitio
//   abierto    las cartas están en la mesa; se voltean una a una o todas
//   guardando  las cartas vuelan a la colección
import { nombreCarta } from './titulos.js'

/** Separación entre cartas al revelar todas de golpe. */
export const PASO_REVELADO_MS = 140

export function estadoInicial() {
  return {
    fase: 'cerrado',
    cartas: [],
    reveladas: [],
    retardos: [],
    instantaneo: false,
    aviso: null,
    abiertosEnVisita: 0,
  }
}

/**
 * Cartas del sobre con su marca de nueva. Si una carta nueva sale dos veces
 * en el mismo sobre, solo la primera es «nueva»; la segunda ya es repetida.
 */
export function cartasDelSobre(ids, nuevas) {
  const pendientes = new Set(nuevas)
  return ids.map((id) => {
    const nueva = pendientes.delete(id)
    return { id, nueva }
  })
}

export const todasReveladas = (estado) => estado.cartas.length > 0 && estado.reveladas.every(Boolean)

/** Retardo de la última carta en darse la vuelta (para esperar al resumen). */
export const ultimoRetardo = (estado) => Math.max(0, ...estado.retardos)

export function ceremonia(estado, accion) {
  switch (accion.tipo) {
    case 'abrir': {
      if (estado.fase !== 'cerrado') return estado
      const cartas = cartasDelSobre(accion.ids, accion.nuevas)
      return {
        ...estado,
        fase: 'abriendo',
        cartas,
        reveladas: cartas.map(() => false),
        retardos: cartas.map(() => 0),
        instantaneo: false,
        aviso: { tipo: 'abierto' },
        abiertosEnVisita: estado.abiertosEnVisita + 1,
      }
    }

    case 'abierto':
      return estado.fase === 'abriendo' ? { ...estado, fase: 'abierto' } : estado

    case 'revelar': {
      const i = accion.indice
      if (!['abriendo', 'abierto'].includes(estado.fase) || estado.reveladas[i] !== false) return estado
      const reveladas = estado.reveladas.map((vista, j) => vista || j === i)
      const retardos = estado.retardos.map((r, j) => (j === i ? 0 : r))
      const completo = reveladas.every(Boolean)
      return { ...estado, reveladas, retardos, aviso: completo ? { tipo: 'resumen', ultima: i } : { tipo: 'carta', indice: i } }
    }

    case 'revelarTodas': {
      if (!['abriendo', 'abierto'].includes(estado.fase) || todasReveladas(estado)) return estado
      let orden = 0
      const retardos = estado.reveladas.map((vista) => (vista ? 0 : orden++ * PASO_REVELADO_MS))
      return { ...estado, reveladas: estado.reveladas.map(() => true), retardos, aviso: { tipo: 'resumen' } }
    }

    case 'saltar':
      if (!['abriendo', 'abierto'].includes(estado.fase)) return estado
      return {
        ...estado,
        fase: 'abierto',
        reveladas: estado.reveladas.map(() => true),
        retardos: estado.retardos.map(() => 0),
        instantaneo: true,
        aviso: { tipo: 'resumen' },
      }

    case 'guardar':
      return estado.fase === 'abierto' && todasReveladas(estado) ? { ...estado, fase: 'guardando' } : estado

    case 'guardado':
      if (estado.fase !== 'guardando') return estado
      return {
        ...estado,
        fase: 'cerrado',
        cartas: [],
        reveladas: [],
        retardos: [],
        instantaneo: false,
        aviso: { tipo: 'guardado', n: estado.cartas.length },
      }

    default:
      return estado
  }
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/** «a», «a y b», «a, b y c». */
function enumerar(partes) {
  if (partes.length < 2) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`
}

const contar = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`

/** Recuento del sobre: nuevas, repetidas y especiales. */
export function resumenSobre(cartas, esEspecial) {
  let nuevas = 0
  let especiales = 0
  for (const c of cartas) {
    if (c.nueva) nuevas++
    if (esEspecial(c.id)) especiales++
  }
  return { nuevas, repetidas: cartas.length - nuevas, especiales }
}

/** «3 nuevas, 2 repetidas y 1 especial». */
export function textoResumen({ nuevas, repetidas, especiales }) {
  return enumerar(
    [
      nuevas > 0 && contar(nuevas, 'nueva', 'nuevas'),
      repetidas > 0 && contar(repetidas, 'repetida', 'repetidas'),
      especiales > 0 && contar(especiales, 'especial', 'especiales'),
    ].filter(Boolean),
  )
}

/** Tiempo de espera legible: «5 h 12 min», «40 min», «menos de un minuto». */
export function formatoEspera(ms) {
  if (ms < 60000) return 'menos de un minuto'
  const minutos = Math.ceil(ms / 60000)
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/**
 * Texto para la región aria-live. `carta(id)` busca en el catálogo,
 * `copias(id)` cuenta las que tiene el visitante y `esEspecial(id)` dice si
 * es especial.
 */
export function textoAviso(estado, { carta, copias, esEspecial }) {
  const { aviso, cartas } = estado
  if (!aviso) return ''
  switch (aviso.tipo) {
    case 'abierto':
      return `Sobre abierto: ${cartas.length} cartas boca abajo. Pulsa cada una para darle la vuelta.`
    case 'carta':
      return describir(aviso.indice, cartas, { carta, copias, esEspecial })
    case 'resumen': {
      const ultima = aviso.ultima === undefined ? '' : `${describir(aviso.ultima, cartas, { carta, copias, esEspecial })} `
      return `${ultima}Sobre revelado: ${textoResumen(resumenSobre(cartas, esEspecial))}.`
    }
    case 'guardado':
      return `${contar(aviso.n, 'carta guardada', 'cartas guardadas')} en tu colección.`
    default:
      return ''
  }
}

function describir(i, cartas, { carta, copias, esEspecial }) {
  const { id, nueva } = cartas[i]
  const c = carta(id)
  const partes = [`Carta ${i + 1} de ${cartas.length}: ${nombreCarta(c)}, de ${c.anime}.`]
  if (esEspecial(id)) partes.push('Especial.')
  partes.push(nueva ? 'Nueva.' : `Repetida: tienes ${copias(id)}.`)
  return partes.join(' ')
}
