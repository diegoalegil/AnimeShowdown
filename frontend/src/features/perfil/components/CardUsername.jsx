import { AtSign } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../contexts/AuthContext'
import UsernamePicker from '../../../components/onboarding/UsernamePicker'

/**
 * V-8: cambia el username desde Ajustes. Reutiliza UsernamePicker (mismas
 * sugerencias + disponibilidad en vivo que el onboarding).
 */
function CardUsername({ user }) {
  const { changeUsername } = useAuth()

  const onSubmit = async (username) => {
    const nuevo = await changeUsername(username)
    toast.success('Username actualizado', {
      description: `Tu perfil público ahora es /u/${nuevo}.`,
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <AtSign className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">Tu username</h2>
      </div>
      <p className="mb-5 text-[12px] text-fg-muted">
        Es tu identidad pública en AnimeShowdown y la URL de tu perfil
        (/u/{user.username}). Puedes cambiarlo cuando quieras; debe ser único.
      </p>
      <UsernamePicker
        currentUsername={user.username}
        onSubmit={onSubmit}
        submitLabel="Guardar username"
      />
    </div>
  )
}

export default CardUsername
