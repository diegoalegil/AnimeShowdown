import { useState } from 'react'

/**
 * Banda de banner del perfil (V35). Muestra `bannerUrl` y, si no hay, cae al
 * arte del personaje favorito (`fallbackImagenUrl`) — el banner es identidad
 * pura y nunca queda genérico. Si tampoco hay favorito (usuario sin votos),
 * pinta un degradado de marca. Lleva un velo inferior para que el avatar y el
 * nombre que se solapan encima sigan legibles.
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
  const mostrarImg = src && !failed

  return (
    <div
      className={`relative w-full overflow-hidden bg-surface-alt ${className}`}
      aria-hidden={!mostrarImg}
    >
      {mostrarImg ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/45 via-surface to-bg" />
      )}
      {/* Velo inferior: oscurece la franja donde se apoya el avatar + nombre. */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
    </div>
  )
}

export default ProfileBanner
