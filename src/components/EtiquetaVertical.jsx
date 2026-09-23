// Texto japonés en escritura vertical (tategaki). Acompaña a un texto en
// español que ya da el significado, así que por defecto es decorativo.
// Un salto de línea («\n») en `ja` empieza otra columna, a la izquierda.

export function EtiquetaVertical({ ja, className = '', decorativa = true, as: Etiqueta = 'span' }) {
  const columnas = ja.split('\n')
  return (
    <Etiqueta lang="ja" className={`tate ${className}`} aria-hidden={decorativa || undefined}>
      {columnas.length === 1
        ? ja
        : columnas.map((columna, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {columna}
            </span>
          ))}
    </Etiqueta>
  )
}
