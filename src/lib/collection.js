// Colección local: qué cartas tiene cada visitante y cuántos sobres le
// quedan hoy. Todo vive en localStorage; no hay cuentas ni servidor.
//
// Formato guardado (versión 1):
//   {
//     v: 1,
//     tengo:    { [idCarta]: copias },         // copias ≥ 1
//     desde:    { [idCarta]: 'AAAA-MM-DD' },   // día en que se consiguió la primera
//     dia:      'AAAA-MM-DD',                  // día local de `abiertos`
//     abiertos: 0..SOBRES_POR_DIA,             // sobres abiertos ese día
//     ultimo:   [idCarta, …]                   // contenido del último sobre
//   }
import {
  CARTAS_POR_SOBRE,
  CLAVE_ALMACEN,
  PROB_ESPECIAL,
  SOBRES_POR_DIA,
  VERSION_ALMACEN,
} from '../config.js'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const MAX_COPIAS = 99999

/** Día local del navegador en formato AAAA-MM-DD. */
export function diaLocal(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}

/** Milisegundos hasta la próxima medianoche local. */
export function msHastaMedianoche(fecha = new Date()) {
  const manana = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1)
  return manana.getTime() - fecha.getTime()
}

export function estadoVacio(dia) {
  return { v: VERSION_ALMACEN, tengo: {}, desde: {}, dia, abiertos: 0, ultimo: [] }
}

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x)
const esCopias = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_COPIAS

/**
 * Limpia las cartas de un objeto { id: copias } y sus fechas: descarta ids
 * desconocidos o cantidades inválidas. Devuelve también cuántas descartó.
 */
function limpiarCartas(tengo, desde, { existe, diaPorDefecto }) {
  const limpio = { tengo: {}, desde: {}, descartadas: 0 }
  if (!esObjeto(tengo)) return limpio
  for (const [id, copias] of Object.entries(tengo)) {
    if (!esCopias(copias) || id === '__proto__' || (existe && !existe(id))) {
      limpio.descartadas++
      continue
    }
    limpio.tengo[id] = copias
    const fecha = esObjeto(desde) ? desde[id] : undefined
    limpio.desde[id] = typeof fecha === 'string' && FECHA.test(fecha) ? fecha : diaPorDefecto
  }
  return limpio
}

/**
 * Convierte cualquier valor leído del almacenamiento en un estado válido para
 * el día `dia`. Si el día guardado es otro, el contador de sobres vuelve a 0.
 */
export function sanear(bruto, { dia, existe } = {}) {
  if (!esObjeto(bruto) || bruto.v !== VERSION_ALMACEN) return estadoVacio(dia)
  const { tengo, desde } = limpiarCartas(bruto.tengo, bruto.desde, { existe, diaPorDefecto: dia })
  const mismoDia = bruto.dia === dia
  const abiertos = mismoDia && Number.isInteger(bruto.abiertos) ? Math.min(Math.max(bruto.abiertos, 0), SOBRES_POR_DIA) : 0
  const ultimo = Array.isArray(bruto.ultimo) ? bruto.ultimo.filter((id) => typeof id === 'string' && Object.hasOwn(tengo, id)) : []
  return { v: VERSION_ALMACEN, tengo, desde, dia, abiertos, ultimo }
}

/** Sobres que quedan por abrir hoy. */
export function sobresRestantes(estado, dia) {
  if (estado.dia !== dia) return SOBRES_POR_DIA
  return Math.max(0, SOBRES_POR_DIA - estado.abiertos)
}

/** Número de cartas distintas en la colección. */
export const cartasDistintas = (estado) => Object.keys(estado.tengo).length

/** Número total de copias, contando repetidas. */
export const copiasTotales = (estado) => Object.values(estado.tengo).reduce((a, n) => a + n, 0)

/** Una carta es «nueva» (sello 新) el día en que se consiguió por primera vez. */
export const esNueva = (estado, id, dia) => estado.desde[id] === dia

const elegir = (lista, rng) => lista[Math.min(Math.floor(rng() * lista.length), lista.length - 1)]

/**
 * Genera el contenido de un sobre. Las cartas 1 a 4 son personajes al azar
 * (uniforme); la última es especial con probabilidad PROB_ESPECIAL (uniforme
 * entre las especiales) y si no, otro personaje. Se admiten repetidas.
 */
export function generarSobre({ personajes, especiales, rng = Math.random }) {
  if (!personajes.length) throw new Error('No hay personajes en el catálogo')
  const sobre = []
  for (let i = 0; i < CARTAS_POR_SOBRE - 1; i++) sobre.push(elegir(personajes, rng))
  const especial = especiales.length > 0 && rng() < PROB_ESPECIAL
  sobre.push(especial ? elegir(especiales, rng) : elegir(personajes, rng))
  return sobre
}

/**
 * Añade un sobre ya generado a la colección. Devuelve el estado nuevo y los
 * ids que se han conseguido por primera vez. Lanza un error si hoy ya no
 * quedan sobres.
 */
export function abrirSobre(estado, ids, dia) {
  const base = estado.dia === dia ? estado : { ...estado, dia, abiertos: 0 }
  if (sobresRestantes(base, dia) <= 0) throw new Error('Hoy ya no quedan sobres')
  const tengo = { ...base.tengo }
  const desde = { ...base.desde }
  const nuevas = []
  for (const id of ids) {
    if (!tengo[id]) {
      desde[id] = dia
      nuevas.push(id)
    }
    tengo[id] = Math.min((tengo[id] ?? 0) + 1, MAX_COPIAS)
  }
  return { estado: { ...base, tengo, desde, abiertos: base.abiertos + 1, ultimo: [...ids] }, nuevas }
}

// ---------------------------------------------------------------------------
// Exportar e importar: un código copiable (JSON en base64) con las cartas.
// Los contadores del día no viajan: importar no regala sobres.
// ---------------------------------------------------------------------------

function aBase64(texto) {
  const bytes = new TextEncoder().encode(texto)
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario)
}

function deBase64(codigo) {
  const binario = atob(codigo)
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export function exportar(estado) {
  return aBase64(JSON.stringify({ v: VERSION_ALMACEN, tengo: estado.tengo, desde: estado.desde }))
}

/**
 * Valida un código de exportación. Devuelve { ok: true, tengo, desde,
 * descartadas } o { ok: false, error } con un mensaje para mostrar.
 */
export function leerCodigo(codigo, { existe, dia } = {}) {
  const limpio = String(codigo ?? '').replace(/\s+/g, '')
  if (!limpio) return { ok: false, error: 'Pega un código de colección.' }
  let datos
  try {
    datos = JSON.parse(deBase64(limpio))
  } catch {
    return { ok: false, error: 'El código no es válido. Cópialo de nuevo, completo.' }
  }
  if (!esObjeto(datos) || datos.v !== VERSION_ALMACEN || !esObjeto(datos.tengo)) {
    return { ok: false, error: 'El código no corresponde a una colección de AnimeShowdown.' }
  }
  const { tengo, desde, descartadas } = limpiarCartas(datos.tengo, datos.desde, { existe, diaPorDefecto: dia })
  if (!Object.keys(tengo).length && descartadas > 0) {
    return { ok: false, error: 'El código no contiene ninguna carta de este catálogo.' }
  }
  return { ok: true, tengo, desde, descartadas }
}

/** Sustituye las cartas del estado por las importadas, sin tocar los sobres del día. */
export function aplicarImportacion(estado, { tengo, desde }) {
  return { ...estado, tengo: { ...tengo }, desde: { ...desde }, ultimo: [] }
}

// ---------------------------------------------------------------------------
// Almacén: estado en memoria sincronizado con localStorage.
// ---------------------------------------------------------------------------

/**
 * Envoltorio de Storage que nunca lanza: si localStorage no existe, está
 * bloqueado o lleno, la colección sigue funcionando en memoria.
 */
export function almacenSeguro(obtener) {
  const memoria = new Map()
  const storage = () => {
    try {
      return obtener() ?? null
    } catch {
      return null
    }
  }
  return {
    leer(clave) {
      try {
        const s = storage()
        if (s) return s.getItem(clave)
      } catch {
        // Lectura bloqueada: se usa la copia en memoria.
      }
      return memoria.get(clave) ?? null
    },
    escribir(clave, valor) {
      memoria.set(clave, valor)
      try {
        storage()?.setItem(clave, valor)
      } catch {
        // Cuota llena o almacenamiento bloqueado: queda en memoria.
      }
    },
  }
}

/**
 * Crea el almacén de la colección, compatible con useSyncExternalStore.
 *
 * @param {object} opciones
 * @param {() => Storage} opciones.storage  acceso perezoso a localStorage
 * @param {{ personajes: string[], especiales: string[] }} opciones.ids
 * @param {(id: string) => boolean} opciones.existe
 * @param {() => Date} [opciones.ahora]
 * @param {Window} [opciones.ventana]  para escuchar otras pestañas y la medianoche
 */
export function crearAlmacen({ storage, ids, existe, ahora = () => new Date(), ventana, clave = CLAVE_ALMACEN }) {
  const disco = almacenSeguro(storage)
  const oyentes = new Set()
  let estado = null
  let temporizador = null

  const hoy = () => diaLocal(ahora())

  function leerDisco() {
    let bruto
    try {
      bruto = JSON.parse(disco.leer(clave) ?? 'null')
    } catch {
      bruto = null
    }
    return sanear(bruto, { dia: hoy(), existe })
  }

  function emitir() {
    for (const oyente of oyentes) oyente()
  }

  function guardar(nuevo) {
    estado = nuevo
    disco.escribir(clave, JSON.stringify(nuevo))
    emitir()
  }

  /** Relee el día: al pasar la medianoche el contador de sobres vuelve a 0. */
  function refrescar() {
    if (!estado) return
    const dia = hoy()
    if (estado.dia !== dia) {
      estado = sanear(estado, { dia, existe })
      emitir()
    }
  }

  function programarMedianoche() {
    clearTimeout(temporizador)
    // Un segundo de margen para no despertar justo antes de las 00:00.
    temporizador = setTimeout(() => {
      refrescar()
      programarMedianoche()
    }, msHastaMedianoche(ahora()) + 1000)
  }

  function alCambiarOtraPestana(evento) {
    if (evento.key !== clave) return
    estado = leerDisco()
    emitir()
  }

  function alVolver() {
    if (ventana?.document?.visibilityState !== 'hidden') refrescar()
  }

  function getSnapshot() {
    if (!estado) estado = leerDisco()
    return estado
  }

  return {
    getSnapshot,

    subscribe(oyente) {
      oyentes.add(oyente)
      if (oyentes.size === 1 && ventana) {
        ventana.addEventListener('storage', alCambiarOtraPestana)
        ventana.document?.addEventListener('visibilitychange', alVolver)
        programarMedianoche()
      }
      return () => {
        oyentes.delete(oyente)
        if (oyentes.size === 0 && ventana) {
          ventana.removeEventListener('storage', alCambiarOtraPestana)
          ventana.document?.removeEventListener('visibilitychange', alVolver)
          clearTimeout(temporizador)
        }
      }
    },

    /** Abre un sobre: devuelve { ids, nuevas } o lanza si no quedan. */
    abrirSobre(rng = Math.random) {
      getSnapshot()
      refrescar()
      const sobre = generarSobre({ personajes: ids.personajes, especiales: ids.especiales, rng })
      const { estado: nuevo, nuevas } = abrirSobre(estado, sobre, hoy())
      guardar(nuevo)
      return { ids: sobre, nuevas }
    },

    exportar() {
      return exportar(getSnapshot())
    },

    /** Importa un código; devuelve el resultado de leerCodigo. */
    importar(codigo) {
      const resultado = leerCodigo(codigo, { existe, dia: hoy() })
      if (resultado.ok) guardar(aplicarImportacion(getSnapshot(), resultado))
      return resultado
    },

    hoy,
  }
}
