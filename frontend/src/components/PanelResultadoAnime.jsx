import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Share2, Sparkles, Swords, Trophy, X } from 'lucide-react'
import { toast } from 'sonner'
import { recordDailyShare, setDailyGamesCompleted } from '../lib/dailyProgress'
import { shareOrCopy } from '../lib/share'

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
 * - identity: contrato visual del anime objetivo
 * - showDailyActions: muestra CTAs hacia misión diaria y votos
 * - children: contenido extra al final (links de navegación)
 */
function PanelResultadoAnime({
  acertado,
  titulo,
  tier,
  squares,
  shareText,
  shareTitle = 'AnimeShowdown Daily Trial',
  shareUrl = '/games',
  bonusBadge,
  kanji,
  identity,
  showDailyActions = true,
  children,
}) {
  const [fallbackText, setFallbackText] = useState('')

  useEffect(() => {
    setDailyGamesCompleted(1)
  }, [])

  const compartir = async () => {
    try {
      const result = await shareOrCopy({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(
        result === 'native'
          ? 'Resultado compartido'
          : 'Resultado copiado al portapapeles',
      )
      setFallbackText('')
    } catch (error) {
      setFallbackText(error?.message || shareText)
      toast.error('No se pudo copiar', {
        description: 'Te dejo el texto visible para copiarlo a mano.',
      })
    }
  }

  const resultIdentity = identity && !identity.isFallback ? identity : null
  const resultAccent = resultIdentity?.accentRgb ?? (acertado ? '52 211 153' : '244 63 94')
  const resultGlow = resultIdentity?.glowRgb ?? (acertado ? '34 211 238' : '168 85 247')
  const kanjiFinal = kanji ?? resultIdentity?.kanji ?? (acertado ? '結' : '残')

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Resultado del juego: ${titulo}${tier ? `. ${tier}` : ''}`}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      className={`relative mb-6 overflow-hidden rounded-2xl border p-6 ${
        acertado
          ? 'border-success/40 bg-gradient-to-br from-success/15 via-electric/5 to-rarity-epic/10'
          : 'border-danger/40 bg-gradient-to-br from-danger/15 via-rarity-epic/5 to-bg/20'
      }`}
      style={{
        '--result-accent': resultAccent,
        '--result-glow': resultGlow,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(circle at 18% 0%, rgb(var(--result-accent) / 0.20), transparent 34%), radial-gradient(circle at 90% 28%, rgb(var(--result-glow) / 0.16), transparent 30%)',
        }}
      />
      <span
        aria-hidden="true"
        lang="ja"
        className={`pointer-events-none absolute -right-2 -top-4 select-none font-mono text-[7rem] leading-none opacity-[0.07] ${
          acertado ? 'text-success' : 'text-danger'
        }`}
      >
        {kanjiFinal}
      </span>
      {acertado && (
        <>
          <Sparkles className="absolute right-4 top-4 h-4 w-4 animate-pulse text-success/70" />
          <Sparkles className="absolute bottom-6 right-12 h-3 w-3 animate-pulse text-electric/60 [animation-delay:0.4s]" />
          <Sparkles className="absolute left-8 top-10 h-3 w-3 animate-pulse text-rarity-epic/60 [animation-delay:0.8s]" />
        </>
      )}

      <div className="relative">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
              acertado
                ? 'bg-success/30 text-success'
                : 'bg-danger/25 text-danger'
            }`}
          >
            {acertado ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </span>
          <p
            className={`text-[11px] font-semibold ${
              acertado ? 'text-success' : 'text-danger'
            }`}
          >
            <span lang="ja">{acertado ? '勝利' : '敗北'}</span>
            {acertado ? ' · Victoria' : ' · Sin intentos'}
          </p>
        </div>
        {resultIdentity && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-fg-muted"
              title={resultIdentity.copy}
            >
              <span lang="ja" className="font-mono text-gold">
                {resultIdentity.kanji}
              </span>
              {resultIdentity.title} · {resultIdentity.emblem}
            </span>
            {resultIdentity.motifs?.slice(0, 2).map((motif) => (
              <span
                key={motif}
                className="rounded-full border border-white/10 bg-bg/35 px-2.5 py-1 text-[11px] font-semibold text-fg-muted"
              >
                {motif}
              </span>
            ))}
          </div>
        )}
        <p className="mb-1 text-2xl font-extrabold leading-tight tracking-tight text-fg-strong">
          {titulo}
        </p>
        {tier && (
          <p
            className={`mb-4 text-[13px] font-semibold ${
              acertado ? 'text-success/90' : 'text-danger/90'
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
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-base ${
                  s.ok
                    ? 'border border-success/40 bg-success/15'
                    : 'border border-danger/30 bg-danger/10'
                }`}
                aria-label={s.ok ? 'acierto' : 'fallo'}
              >
                {s.emoji ?? (s.ok ? '🌸' : '🍂')}
              </span>
            ))}
            {bonusBadge && (
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gold/40 bg-gold/15 text-base"
                aria-label={bonusBadge.label}
                title={bonusBadge.label}
              >
                {bonusBadge.emoji}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={compartir}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Share2 className="h-3.5 w-3.5" />
            Compartir resultado
          </button>
          {showDailyActions && (
            <>
              <Link
                to="/misiones"
                className="inline-flex items-center gap-1.5 rounded-lg border border-success/35 bg-success/10 px-4 py-2 text-[13px] font-semibold text-success transition-colors hover:bg-success/20"
              >
                <Trophy className="h-3.5 w-3.5" />
                Ver misión
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                to="/votar"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/55 px-4 py-2 text-[13px] font-semibold text-fg-strong transition-colors hover:border-accent/45 hover:text-gold"
              >
                <Swords className="h-3.5 w-3.5" />
                Votar duelos
              </Link>
            </>
          )}
        </div>

        {fallbackText && (
          <textarea
            readOnly
            value={fallbackText}
            className="mt-3 min-h-28 w-full rounded-lg border border-border bg-bg/70 p-3 text-[12px] leading-5 text-fg-muted outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label="Texto del resultado para copiar manualmente"
          />
        )}

        {children && <div className="mt-4">{children}</div>}
      </div>
    </motion.div>
  )
}

export default PanelResultadoAnime
