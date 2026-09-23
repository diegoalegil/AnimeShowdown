import { Component } from 'react'
import { EtiquetaVertical } from './EtiquetaVertical.jsx'

/**
 * Límite de errores de una sección: si su código no llega a descargarse o
 * falla al pintarse, la cabecera y el pie siguen ahí y la sección muestra
 * un aviso con la opción de recargar. Al cambiar `clave` (la ruta) se
 * vuelve a intentar pintar la sección.
 */
export class FalloSeccion extends Component {
  state = { error: null, clave: this.props.clave }

  static getDerivedStateFromError(error) {
    return { error }
  }

  static getDerivedStateFromProps(props, state) {
    return props.clave === state.clave ? null : { error: null, clave: props.clave }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="wrap fallo" role="alert">
        <EtiquetaVertical ja="不具合" className="fallo-tate" />
        <div className="min-w-0">
          <p className="fallo-titulo">No se pudo cargar esta sección.</p>
          <p className="fallo-texto">Puede que la conexión se haya cortado un momento. Tu colección no se ha perdido.</p>
          <button type="button" className="enlace-tinta fallo-boton" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }
}
