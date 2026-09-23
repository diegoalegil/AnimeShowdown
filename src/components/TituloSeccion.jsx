import { EtiquetaVertical } from './EtiquetaVertical.jsx'

/**
 * Encabezado de sección: etiqueta japonesa en vertical junto al título en
 * español, que aparece con una pincelada.
 */
export function TituloSeccion({ ja, children, sub, className = '' }) {
  return (
    <header className={`titulo-seccion ${className}`}>
      <EtiquetaVertical ja={ja} className="titulo-seccion-tate" />
      <div className="min-w-0">
        <h1 className="pincel text-3xl sm:text-4xl md:text-5xl">{children}</h1>
        {sub && <p className="titulo-seccion-sub">{sub}</p>}
      </div>
    </header>
  )
}
