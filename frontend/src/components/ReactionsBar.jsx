import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ApiError } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import {
  useAplicarReaccion,
  useReacciones,
} from '../hooks/useReacciones'

/**
 * Barra horizontal de reactions emoji (Plan v2 §4.3).
 *
 * 4 botones FIRE/HEART/LAUGH/CRY con count debajo. La reaction del usuario
 * actual queda resaltada (bg accent suave + borde). Click:
 *   - Si no estaba logueado → toast con CTA "Inicia sesión".
 *   - Si la misma que ya tenía → toggle off.
 *   - Si distinta → swap.
 *
 * La lógica toggle/swap vive en backend; aquí solo enviamos el tipo
 * clicado y el server responde con el nuevo resumen.
 */

const EMOJIS = [
  { tipo: 'FIRE',  glyph: '🔥', label: 'Fuego' },
  { tipo: 'HEART', glyph: '❤️', label: 'Me encanta' },
  { tipo: 'LAUGH', glyph: '😂', label: 'Divertido' },
  { tipo: 'CRY',   glyph: '😢', label: 'Me da pena' },
]

function ReactionsBar({ targetType, targetId, className = '' }) {
  const { user } = useAuth()
  const { play } = useSound()
  const navigate = useNavigate()
  const { data, isLoading } = useReacciones(targetType, targetId)
  const mutation = useAplicarReaccion(targetType, targetId)

  const mia = data?.miReaccion ?? null
  const counts = data?.counts ?? {}
  const total = data?.total ?? 0

  const handleClick = (tipo) => {
    play('playClick')
    if (!user) {
      toast('Inicia sesión para reaccionar', {
        description: 'Solo los usuarios logueados pueden reaccionar.',
        action: { label: 'Entrar', onClick: () => navigate('/login') },
      })
      return
    }
    mutation.mutate(tipo, {
      onError: (err) => {
        const msg =
          err instanceof ApiError ? err.message : 'No se pudo aplicar la reacción.'
        toast.error('Error', { description: msg })
      },
    })
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {EMOJIS.map(({ tipo, glyph, label }) => {
        const seleccionada = mia === tipo
        const count = counts[tipo] ?? 0
        return (
          <motion.button
            key={tipo}
            type="button"
            onClick={() => handleClick(tipo)}
            disabled={mutation.isPending || isLoading}
            aria-label={label}
            aria-pressed={seleccionada}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              seleccionada
                ? 'border-accent bg-accent/15 text-fg-strong'
                : 'border-border bg-surface text-fg hover:border-accent/40 hover:bg-surface-alt'
            }`}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {glyph}
            </span>
            <span className="tabular-nums">{count}</span>
          </motion.button>
        )
      })}
      {total > 0 && (
        <span className="ml-1 text-[11px] text-fg-muted">
          · {total} reacci{total === 1 ? 'ón' : 'ones'}
        </span>
      )}
    </div>
  )
}

export default ReactionsBar
