// Al volver de una ficha, la página de cartas que seguía montada y oculta
// (ver App.jsx) se vuelve a mostrar dentro de la View Transition. Safari
// calcula entonces el estilo de toda la página, también de los grupos que
// content-visibility se salta: con mil cartas eran unos 200 ms en un solo
// frame. Los grupos lejos de la carta a la que se vuelve se muestran vacíos
// (conservan la altura que content-visibility recuerda) y recuperan sus
// cartas poco a poco, de los más cercanos a los más lejanos, cuando la
// transición ya ha terminado.

/** Grupos a cada lado de la carta de destino que se muestran enteros desde el principio. */
export const MARGEN_GRUPOS = 3
const ESPERA_MS = 900
const LOTE = 4
const PAUSA_MS = 40

/**
 * Índices de `total` grupos ordenados por cercanía a `k`, sin los que quedan
 * a `margen` o menos (esos no se aplazan).
 */
export function ordenLejanos(total, k, margen = MARGEN_GRUPOS) {
  const orden = []
  for (let d = margen + 1; d < total; d++) {
    if (k - d >= 0) orden.push(k - d)
    if (k + d < total) orden.push(k + d)
  }
  return orden
}

/**
 * Aplaza los grupos ([data-diferido]) de `raiz` lejanos a la carta `ids`
 * (la primera que exista). Devuelve una función que los suelta todos.
 */
export function aplazarLejanos(raiz, ids = []) {
  if (!raiz) return () => {}
  const grupos = [...raiz.querySelectorAll('[data-diferido]')]
  const carta = ids.map((id) => raiz.querySelector(`[data-id="${CSS.escape(id)}"]`)).find(Boolean)
  const k = carta ? grupos.findIndex((g) => g.contains(carta)) : -1
  if (k < 0) return () => {}
  const lejanos = ordenLejanos(grupos.length, k).map((i) => grupos[i])
  for (const g of lejanos) g.dataset.lejos = ''

  let i = 0
  let temporizador = 0
  const soltarLote = () => {
    const fin = Math.min(i + LOTE, lejanos.length)
    for (; i < fin; i++) delete lejanos[i].dataset.lejos
    if (i < lejanos.length) temporizador = setTimeout(soltarLote, PAUSA_MS)
  }
  temporizador = setTimeout(soltarLote, ESPERA_MS)

  return () => {
    clearTimeout(temporizador)
    for (; i < lejanos.length; i++) delete lejanos[i].dataset.lejos
  }
}
