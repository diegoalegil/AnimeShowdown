import { trozosTate } from '../lib/tategaki.js'

/**
 * Texto japonés preparado para escribirse en vertical: cifras cortas y
 * signos !? de pie en un carácter (ver lib/tategaki). Para usar dentro de
 * un elemento con writing-mode vertical.
 */
export function TextoVertical({ texto }) {
  return trozosTate(texto).map((t, i) =>
    t.tcy ? (
      <span key={i} className="tcy">
        {t.texto}
      </span>
    ) : (
      t.texto
    ),
  )
}

/**
 * Texto japonés en escritura vertical (tategaki). Acompaña a un texto en
 * español que ya da el significado, así que por defecto es decorativo.
 * Un salto de línea («\n») en `ja` empieza otra columna, a la izquierda.
 */
export function EtiquetaVertical({ ja, className = '', decorativa = true, as: Etiqueta = 'span' }) {
  const columnas = ja.split('\n')
  return (
    <Etiqueta lang="ja" className={`tate ${className}`} aria-hidden={decorativa || undefined}>
      {columnas.map((columna, i) => (
        <span key={i}>
          {i > 0 && <br />}
          <TextoVertical texto={columna} />
        </span>
      ))}
    </Etiqueta>
  )
}
