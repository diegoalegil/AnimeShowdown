import { useState } from 'react'

/**
 * Banda de banner del perfil (V35). Muestra `bannerUrl` y, si no hay, cae al
 * arte del personaje favorito (`fallbackImagenUrl`) — el banner es identidad
 * pura y nunca queda genérico. Si tampoco hay favorito (usuario sin votos),
 * pinta un degradado de marca.
 *
 * Tratamiento cinematográfico (V70): detrás del arte real va una copia ampliada
 * y desenfocada de la MISMA imagen, de modo que cualquier proporción se vea
 * intencional. El arte favorito suele ser una carta VERTICAL (con marco y texto
 * incrustados); metida a sangre con `object-cover` se recortaba de forma rara.
 * Ahora se detecta la proporción al cargar: si la imagen es vertical se muestra
 * ENTERA (`object-contain`) flotando sobre el fondo desenfocado; si es apaisada
 * llena la franja (`object-cover`). Un velo inferior (banda sólida abajo) más
 * uno lateral izquierdo garantizan que el avatar y el nombre que se apoyan en el
 * borde inferior izquierdo sigan legibles, sea cual sea la imagen.
 *
 * Presentacional: el caller fija la altura vía `className` (p.ej. "h-32") y
 * compone el avatar solapando el borde inferior.
 */
function ProfileBanner({
  bannerUrl,
  fallbackImagenUrl,
  alt = 'Banner de perfil',
  className = '',
}) {
  const src = bannerUrl || fallbackImagenUrl || null
  const [failed, setFailed] = useState(false)
  const [esVertical, setEsVertical] = useState(false)
  const mostrarImg = src && !failed

  return (
    <div
      className={`relative w-full overflow-hidden bg-surface-alt ${className}`}
      aria-hidden={!mostrarImg}
    >
      {mostrarImg ? (
        <>
          {/* Fondo: copia ampliada y desenfocada del propio arte. Rellena la
              franja con sus colores para que ninguna proporción quede vacía ni
              recortada de forma rara. Decorativo (no se anuncia a lectores). */}
          <img
            src={src}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl"
          />
          <div className="absolute inset-0 bg-bg/40" />
          {/* Arte real: si es vertical (carta) se muestra entero sobre el fondo;
              si es apaisado llena la franja. La proporción se mide al cargar. */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget
              if (w > 0 && h > 0) setEsVertical(h > w * 1.1)
            }}
            className={`absolute inset-0 h-full w-full ${
              esVertical ? 'object-contain' : 'object-cover'
            }`}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/45 via-surface to-bg" />
      )}
      {/* Velo inferior (banda sólida abajo que se desvanece hacia arriba) +
          velo lateral izquierdo: la esquina inferior izquierda donde se apoyan
          el avatar y el nombre queda siempre con contraste suficiente. */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface from-30% via-surface/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-surface/50 via-transparent to-transparent" />
    </div>
  )
}

export default ProfileBanner
