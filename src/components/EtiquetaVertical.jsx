// Texto japonés en escritura vertical (tategaki). Acompaña a un texto en
// español que ya da el significado, así que por defecto es decorativo.

export function EtiquetaVertical({ ja, className = '', decorativa = true, as: Etiqueta = 'span' }) {
  return (
    <Etiqueta lang="ja" className={`tate ${className}`} aria-hidden={decorativa || undefined}>
      {ja}
    </Etiqueta>
  )
}
