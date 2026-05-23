/**
 * Helpers de fallback para <img> que muestran assets de personajes.
 *
 * <p>Cuando una imagen falla (asset 0 bytes, URL borrada, lazy con timeout),
 * el browser pintaría el icono nativo de "imagen rota", que rompe la
 * sensación premium.
 *
 * <p>Estrategia: usar {@link PersonajeImg} cuando podamos (cae a
 * PersonajePlaceholder con kanji + iniciales). Cuando no es viable
 * (avatares ínfimos donde el placeholder rich es overkill, contextos
 * sin slug, drawers, etc.) aplicar {@link ocultaImgRota} al onError —
 * el {@code <img>} queda invisible y el wrapper conserva su tamaño
 * con su bg-surface natural. Nunca aparece el icono de error.
 */

/**
 * Oculta una {@code <img>} rota sin colapsar el espacio que ocupa.
 *
 * <p>Mantenemos {@code visibility:hidden} en vez de {@code display:none}
 * para que el wrapper no haga reflow. El espacio queda como un
 * placeholder gris/oscuro según el bg del padre — preferible al icono
 * de imagen rota del navegador.
 */
export function ocultaImgRota(e) {
  if (!e?.currentTarget) return
  e.currentTarget.style.opacity = '0'
  e.currentTarget.style.visibility = 'hidden'
}
