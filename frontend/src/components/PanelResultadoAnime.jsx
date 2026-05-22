import { motion } from 'framer-motion'
import { Check, Copy, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Panel de resultado compartido entre los juegos del Daily Hub.
 *
 * Sustituye los bloques verde/rojo planos con cuadritos 🟩🟥 por un
 * panel con identidad anime: gradiente diagonal, kanji decorativo de
 * fondo, sparkles animadas al acertar, jerarquía tipográfica fuerte
 * y "squares" como badges con emojis (🌸 acierto, 🍂 fallo).
 *
 * Props:
 * - acertado: boolean
 * - titulo: texto principal (ej "Acertaste en 1/5")
 * - tier: subtítulo bajo el título (ej "Precisión legendaria"); opcional
 * - squares: array de { ok: boolean, emoji?: string } a renderizar como badges
 * - shareText: texto que se copia al portapapeles
 * - bonusBadge: { emoji, label } opcional (ej "💡 pista usada")
 * - kanji: opcional override (default 結 win, 残 lose)
 * - children: contenido extra al final (links de navegación)
 */
function PanelResultadoAnime({
  acertado,
  titulo,
  tier,
  squares,
  shareText,
  bonusBadge,
  kanji,
  children,
}) {
  const compartir = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      toast.success('Resultado copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar', {
        description: 'Selecciona el texto a mano.',
      })
    }
  }

  const kanjiFinal = kanji ?? (acertado ? '結' : '残')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      className={`relative mb-6 overflow-hidden rounded-2xl border p-6 ${
        acertado
          ? 'border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 via-cyan-500/5 to-fuchsia-500/10'
          : 'border-rose-400/40 bg-gradient-to-br from-rose-500/15 via-purple-500/5 to-slate-900/20'
      }`}
    >
      <span
        aria-hidden="true"
        lang="ja"
        className={`pointer-events-none absolute -right-2 -top-4 select-none font-mono text-[7rem] leading-none opacity-[0.07] ${
          acertado ? 'text-emerald-200' : 'text-rose-200'
        }`}
      >
        {kanjiFinal}
      </span>
      {acertado && (
        <>
          <Sparkles className="absolute right-4 top-4 h-4 w-4 animate-pulse text-emerald-300/70" />
          <Sparkles className="absolute bottom-6 right-12 h-3 w-3 animate-pulse text-cyan-300/60 [animation-delay:0.4s]" />
          <Sparkles className="absolute left-8 top-10 h-3 w-3 animate-pulse text-fuchsia-300/60 [animation-delay:0.8s]" />
        </>
      )}

      <div className="relative">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
              acertado
                ? 'bg-emerald-500/30 text-emerald-100'
                : 'bg-rose-500/25 text-rose-100'
            }`}
          >
            {acertado ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </span>
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
              acertado ? 'text-emerald-200' : 'text-rose-200'
            }`}
          >
            <span lang="ja">{acertado ? '勝利' : '敗北'}</span>
            {acertado ? ' · Victoria' : ' · Sin intentos'}
          </p>
        </div>
        <p className="mb-1 text-2xl font-extrabold leading-tight tracking-tight text-fg-strong">
          {titulo}
        </p>
        {tier && (
          <p
            className={`mb-4 text-[13px] font-semibold ${
              acertado ? 'text-emerald-200/90' : 'text-rose-200/90'
            }`}
          >
            {tier}
          </p>
        )}

        {squares && squares.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {squares.map((s, idx) => (
              <span
                key={idx}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-base ${
                  s.ok
                    ? 'border border-emerald-400/40 bg-emerald-500/15'
                    : 'border border-rose-400/30 bg-rose-500/10'
                }`}
                aria-label={s.ok ? 'acierto' : 'fallo'}
              >
                {s.emoji ?? (s.ok ? '🌸' : '🍂')}
              </span>
            ))}
            {bonusBadge && (
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-400/40 bg-amber-500/15 text-base"
                aria-label={bonusBadge.label}
                title={bonusBadge.label}
              >
                {bonusBadge.emoji}
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={compartir}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar resultado
        </button>

        {children && <div className="mt-4">{children}</div>}
      </div>
    </motion.div>
  )
}

export default PanelResultadoAnime
