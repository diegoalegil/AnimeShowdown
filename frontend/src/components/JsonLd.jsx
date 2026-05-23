import { useEffect } from 'react'

/**
 * Inyecta {@code <script type="application/ld+json">} en {@code document.head}
 * con el schema.org pasado como prop.
 *
 * <p>Render-less: no devuelve nada visible, solo gestiona el ciclo de vida
 * del tag script. Al unmount se elimina automáticamente para no acumular
 * múltiples scripts si el usuario navega entre rutas con distinto JSON-LD.
 *
 * <p>Validar con Google Rich Results Test antes de cada deploy. Errores
 * en el JSON-LD no afectan al render del componente — los crawlers los
 * ignoran silenciosamente.
 *
 * @param {Object} props
 * @param {Object|Array} props.schema objeto schema.org (se serializa con JSON.stringify)
 * @param {string} [props.id] id único para distinguir múltiples JsonLd en la misma página
 */
function JsonLd({ schema, id }) {
  useEffect(() => {
    if (!schema) return undefined
    const tag = document.createElement('script')
    tag.type = 'application/ld+json'
    if (id) tag.setAttribute('data-jsonld-id', id)
    // JSON.stringify no escapa '</' que cierra prematuro el <script>
    // si el JSON contiene esa secuencia (raro pero defensivo).
    tag.textContent = JSON.stringify(schema).replace(/<\//g, '<\\/')
    document.head.appendChild(tag)
    return () => {
      if (tag.parentNode) tag.parentNode.removeChild(tag)
    }
  }, [schema, id])
  return null
}

export default JsonLd
