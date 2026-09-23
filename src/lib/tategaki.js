// Reglas de la escritura vertical (tategaki) para los textos japoneses del
// catálogo: las cifras cortas y los signos !? van de pie en un solo carácter
// (tate-chū-yoko) y los nombres largos se reparten en dos columnas.

const ANCHO_COMPLETO = { '!': '！', '?': '？' }
const aAnchoCompleto = (texto) =>
  texto.replace(/[0-9!?]/g, (c) => ANCHO_COMPLETO[c] ?? String.fromCharCode(c.charCodeAt(0) + 0xfee0))

/**
 * Trozos de un texto para escribirlo en vertical: [{ texto, tcy }]. Van en
 * tate-chū-yoko (tcy: true) las series de 1 a 3 cifras ASCII y las de 2 o 3
 * signos !?, como «18», «4» o «!!». Un ! o ? suelto y las series más largas
 * pasan a ancho completo, que ya se escribe de pie.
 */
export function trozosTate(texto) {
  const trozos = []
  let ultimo = 0
  for (const m of texto.matchAll(/[0-9!?]+/g)) {
    if (m.index > ultimo) trozos.push({ texto: texto.slice(ultimo, m.index), tcy: false })
    const serie = m[0]
    const tcy = serie.length <= 3 && (serie.length > 1 || /[0-9]/.test(serie))
    trozos.push(tcy ? { texto: serie, tcy: true } : { texto: aAnchoCompleto(serie), tcy: false })
    ultimo = m.index + serie.length
  }
  if (ultimo < texto.length) trozos.push({ texto: texto.slice(ultimo), tcy: false })
  // Une los trozos de texto normal contiguos (tras convertir signos sueltos).
  return trozos.reduce((acc, t) => {
    const previo = acc.at(-1)
    if (previo && !previo.tcy && !t.tcy) previo.texto += t.texto
    else acc.push({ ...t })
    return acc
  }, [])
}

/** Caracteres a partir de los cuales un nombre original se reparte en dos columnas. */
export const MAX_COLUMNA = 14

/**
 * Columnas para un nombre original en vertical: una si es corto; si pasa de
 * `max` caracteres, dos, cortando solo tras el «・» más cercano a la mitad
 * (nunca dentro de una palabra, así «4世» o «18号» no se separan). Sin «・»
 * queda en una columna.
 */
export function columnasNombre(nombre, max = MAX_COLUMNA) {
  const letras = [...nombre]
  if (letras.length <= max) return [nombre]
  const mitad = letras.length / 2
  let corte = -1
  letras.forEach((c, i) => {
    if (c === '・' && i < letras.length - 1 && (corte < 0 || Math.abs(i + 1 - mitad) < Math.abs(corte - mitad))) corte = i + 1
  })
  if (corte < 0) return [nombre]
  return [letras.slice(0, corte).join(''), letras.slice(corte).join('')]
}
