import AvatarEditor from './AvatarEditor'

function CardAvatar({ user, updateUser }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-fg-strong">
          Personaliza tu avatar
        </h2>
        <p className="text-[12px] text-fg-muted">
          Sube una imagen desde tu equipo, elige una card del catálogo o pega
          una URL pública. Si no eliges ninguna, se usa el avatar generado
          automáticamente con tus iniciales.
        </p>
      </div>
      <AvatarEditor user={user} updateUser={updateUser} />
    </div>
  )
}

export default CardAvatar
