import BannerEditor from './BannerEditor'

/**
 * Card "Personaliza tu banner" en Ajustes (V35). El banner es la cabecera del
 * perfil; si no eliges uno, se usa el arte de tu personaje favorito
 * (`favoritoImagenUrl`, derivado de tu Top 1) para que nunca quede genérico.
 */
function CardBanner({ user, updateUser, favoritoImagenUrl }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-fg-strong">Personaliza tu banner</h2>
        <p className="text-[12px] text-fg-muted">
          Sube una imagen desde tu equipo, elige una card del catálogo o pega
          una URL pública. Si no eliges ninguna, se usa el arte de tu personaje
          favorito como cabecera.
        </p>
      </div>
      <BannerEditor
        user={{ ...user, favoritoImagenUrl }}
        updateUser={updateUser}
      />
    </div>
  )
}

export default CardBanner
