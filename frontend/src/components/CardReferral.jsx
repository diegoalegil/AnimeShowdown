import { useState } from 'react'
import { Copy, Share2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { usePerfilReferral } from '../hooks/usePerfil'
import KanjiSpinner from './KanjiSpinner'

/**
 * Card de referral (Plan v2 §11.8) — código único compartible + count
 * de referidos verificados con progreso hacia el badge "Reclutador".
 *
 * <p>Se monta en /perfil tab Resumen. Si el usuario no tiene código aún
 * (race condition raro), el backend lo genera al vuelo y persiste.
 */
function CardReferral() {
  const { data, isLoading } = usePerfilReferral()
  const [copiado, setCopiado] = useState(false)

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-center py-4">
          <KanjiSpinner size="sm" />
        </div>
      </div>
    )
  }
  if (!data || !data.codigo) return null

  const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://animeshowdown.dev'}/register?ref=${data.codigo}`
  const progresoPct =
    data.umbralReclutador > 0
      ? Math.min(
          100,
          Math.round((data.invitadosVerificados / data.umbralReclutador) * 100),
        )
      : 0

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
      toast.success('Enlace de referral copiado')
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  const handleShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      handleCopy()
      return
    }
    try {
      await navigator.share({
        title: 'Únete a AnimeShowdown',
        text: '¿Cuál es tu personaje favorito? Vota duelos y mueve el ranking ELO conmigo.',
        url,
      })
    } catch (err) {
      if (err?.name !== 'AbortError') {
        // fallback a copiar si share falla por algo distinto a usuario cancelando.
        handleCopy()
      }
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">Tu código de referral</h2>
      </div>
      <p className="mb-4 text-[12px] text-fg-muted">
        Comparte tu enlace. Cuando {data.umbralReclutador} amigos se
        registren y verifiquen email, desbloqueas el badge <strong>Reclutador</strong>.
      </p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 font-mono text-sm">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
            Código
          </p>
          <p className="text-base font-extrabold tracking-[0.18em] text-gold">
            {data.codigo}
          </p>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-2 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
          >
            <Copy className="h-3.5 w-3.5" />
            {copiado ? 'Copiado' : 'Copiar enlace'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-bg transition-opacity hover:opacity-90"
          >
            <Share2 className="h-3.5 w-3.5" />
            Compartir
          </button>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            Progreso hacia Reclutador
          </p>
          <p className="font-mono text-[12px] tabular-nums text-fg-muted">
            <strong className="text-fg-strong">{data.invitadosVerificados}</strong>{' '}
            / {data.umbralReclutador}
          </p>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-bg">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              data.reclutadorDesbloqueado
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-300'
                : 'bg-gradient-to-r from-accent via-fuchsia-400 to-purple-400'
            }`}
            style={{ width: `${progresoPct}%` }}
          />
        </div>
        {data.reclutadorDesbloqueado && (
          <p className="mt-2 text-[11px] text-emerald-300">
            ✓ Badge Reclutador desbloqueado. Cada referido extra cuenta
            para futuras tiers.
          </p>
        )}
      </div>
    </div>
  )
}

export default CardReferral
