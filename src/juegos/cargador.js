// La pantalla de cada juego se descarga aparte, al entrar en él (o antes,
// al pasar por su tarjeta en el hub). Una sola instancia diferida por juego
// (ver lib/diferido): precargada, se pinta sin pasar por el Suspense.
import { diferido } from '../lib/diferido.js'

const pantallas = new Map()

/** { Componente, precargar } de un juego del registro. */
export function pantallaDe(juego) {
  let pantalla = pantallas.get(juego.slug)
  if (!pantalla) {
    pantalla = diferido(juego.cargar)
    pantallas.set(juego.slug, pantalla)
  }
  return pantalla
}

/** Precarga especulativa de la pantalla de un juego: si falla, se pedirá al entrar. */
export function precargarJuego(juego) {
  pantallaDe(juego).precargar().catch(() => {})
}
