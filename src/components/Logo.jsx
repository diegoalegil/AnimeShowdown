import { logo } from '../lib/marca.js'

const LOGO = logo()

/**
 * El sello 滅 de la marca (ver LOGO en lib/marca). `tamano` es el ancho con
 * que se pinta, para que el navegador elija la versión de 64 o de 128 px.
 * Decorativo salvo que lleve `etiqueta`.
 */
export function Logo({ tamano = 40, etiqueta, className = '', prioridad = false }) {
  return (
    <img
      src={LOGO.src}
      srcSet={LOGO.srcSet}
      sizes={`${tamano}px`}
      width={tamano}
      height={tamano}
      alt={etiqueta ?? ''}
      className={`logo ${className}`}
      decoding="async"
      loading={prioridad ? 'eager' : 'lazy'}
      draggable="false"
    />
  )
}
