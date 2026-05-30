import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../contexts/AuthContext'

const BIO_MAX = 240

/**
 * B7 §1a: edita la bio pública desde Ajustes. Textarea corta (máx 240,
 * espejo de la columna usuarios.bio y de la validación del backend) con
 * contador. Reutiliza el shell de card y el estilo de botón de CardUsername /
 * CardPassword. El backend sanitiza a texto plano; aquí solo acotamos longitud.
 */
function CardBio({ user }) {
  const { changeBio } = useAuth()
  const [bio, setBio] = useState(user.bio ?? '')
  const [guardando, setGuardando] = useState(false)

  const original = user.bio ?? ''
  const sinCambios = bio.trim() === original.trim()

  const onSubmit = async (e) => {
    e.preventDefault()
    if (sinCambios || guardando) return
    setGuardando(true)
    try {
      await changeBio(bio)
      toast.success('Bio actualizada', {
        description: 'Tu nueva bio ya es visible en tu perfil público.',
      })
    } catch (err) {
      toast.error('No se pudo guardar la bio', {
        description: err?.message || 'Inténtalo de nuevo en un momento.',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Pencil className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">Tu bio</h2>
      </div>
      <p className="mb-5 text-[12px] text-fg-muted">
        Una breve presentación que aparece en tu perfil público
        (/u/{user.username}). Opcional; puedes dejarla vacía.
      </p>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={3}
        maxLength={BIO_MAX}
        placeholder="Fan de los shōnen, coleccionista de duelos imposibles..."
        className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg-strong placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        disabled={guardando}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] tabular-nums text-fg-muted">
          {bio.length}/{BIO_MAX}
        </span>
        <button
          type="submit"
          disabled={sinCambios || guardando}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar bio'}
        </button>
      </div>
    </form>
  )
}

export default CardBio
