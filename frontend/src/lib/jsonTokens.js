/**
 * jsonTokens.js — tokenizador JSON mínimo para los paneles de papel de /api-docs.
 * Cero dependencias y cero libs de syntax highlight: una sola regex.
 * Módulo .js hermano sin componentes (react-refresh friendly).
 */

/** @typedef {{ type: 'key'|'string'|'number'|'literal'|'plain', text: string }} JsonToken */

const JSON_TOKEN_RE =
  /("(?:[^"\\\n]|\\.)*")(\s*:)|("(?:[^"\\\n]|\\.)*")|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\b(?:true|false|null)\b)/g

/**
 * Trocea una cadena JSON YA formateada en tokens tipados para pintarla con
 * <span class="apibp-tk-*">. No valida ni parsea: pensado para ejemplos cortos
 * de documentación, no para JSON arbitrario de usuario.
 *
 * @param {string} src JSON formateado (p. ej. JSON.stringify(x, null, 2))
 * @returns {JsonToken[]} lista ordenada de tokens; concatenados == src
 */
export function tokenizeJson(src) {
  /** @type {JsonToken[]} */
  const out = []
  if (typeof src !== 'string' || src.length === 0) return out
  let last = 0
  for (const m of src.matchAll(JSON_TOKEN_RE)) {
    const i = m.index
    if (i > last) out.push({ type: 'plain', text: src.slice(last, i) })
    if (m[1] !== undefined) {
      out.push({ type: 'key', text: m[1] })
      out.push({ type: 'plain', text: m[2] })
    } else if (m[3] !== undefined) {
      out.push({ type: 'string', text: m[3] })
    } else if (m[4] !== undefined) {
      out.push({ type: 'number', text: m[4] })
    } else {
      out.push({ type: 'literal', text: m[5] })
    }
    last = i + m[0].length
  }
  if (last < src.length) out.push({ type: 'plain', text: src.slice(last) })
  return out
}
