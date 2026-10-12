// Lo poco que Omikuji guarda en el navegador: la sal (una sola vez, para que
// la suerte del día sea de este visitante) y el último día revelado (para
// volver a ver la fortuna sin agitar otra vez). Todo lo leído se sanea.
import { CLAVE_ALMACEN, esSal, nuevaSal } from './reglas.js'

/** true si `dia` tiene la forma AAAA-MM-DD. */
const esDia = (dia) => typeof dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dia)

const almacenPorDefecto = () => (typeof window !== 'undefined' ? window.localStorage : undefined)

/**
 * Lee lo guardado y lo devuelve saneado: { sal, revelado }. Si no hay sal
 * válida crea una nueva (y la deja guardada). `revelado` es el día (AAAA-MM-DD)
 * en que se reveló la última fortuna, o null.
 */
export function leerEstado(almacen = almacenPorDefecto(), rng = Math.random) {
  let leido
  try {
    const bruto = almacen?.getItem(CLAVE_ALMACEN)
    leido = bruto ? JSON.parse(bruto) : null
  } catch {
    leido = null
  }
  const objeto = leido !== null && typeof leido === 'object' ? leido : {}
  const estado = {
    sal: esSal(objeto.sal) ? objeto.sal : nuevaSal(rng),
    revelado: esDia(objeto.revelado) ? objeto.revelado : null,
  }
  if (estado.sal !== objeto.sal) guardarEstado(estado, almacen)
  return estado
}

/** Guarda { sal, revelado }; si el disco falla (modo privado, cuota), no pasa nada. */
export function guardarEstado(estado, almacen = almacenPorDefecto()) {
  try {
    almacen?.setItem(CLAVE_ALMACEN, JSON.stringify({ v: 1, sal: estado.sal, revelado: estado.revelado }))
  } catch {
    // Sin disco la fortuna sigue saliendo; solo se pierde el recuerdo.
  }
}
