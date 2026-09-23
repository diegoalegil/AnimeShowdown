// Mientras se abre un sobre, el contador de la cabecera sigue mostrando la
// cuenta de antes: las cartas ya están guardadas, pero «llegan» a la
// colección al final de la ceremonia, cuando vuelan hasta él. Así el número
// no adelanta cuántas cartas nuevas trae el sobre antes de voltearlas.

export function crearRetencion() {
  let retenida = null
  const oyentes = new Set()
  const emitir = () => {
    for (const oyente of oyentes) oyente()
  }
  return {
    /** Congela la cuenta visible en `n` (si ya estaba congelada, no cambia). */
    retener(n) {
      if (retenida !== null) return
      retenida = n
      emitir()
    },
    soltar() {
      if (retenida === null) return
      retenida = null
      emitir()
    },
    subscribe(oyente) {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
    getSnapshot: () => retenida,
  }
}

export const cuentaRetenida = crearRetencion()
