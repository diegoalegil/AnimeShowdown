import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { MIN_STREAK, getStreakTier } from '../vote-streak'

const TIER_CLASSES = {
  base: 'border-border bg-surface/95 text-fg-strong',
  oro: 'border-gold/50 bg-surface/95 text-gold shadow-aura-sm',
  electrica: 'border-electric/50 bg-surface/95 text-electric shadow-aura-sm',
  legendaria: 'border-gold/70 text-gold-pale shadow-aura motion-safe:animate-shimmer',
}

const TIER_STYLES = {
  base: undefined,
  oro: { '--aura-color': 'var(--color-gold-aura)' },
  electrica: {
    '--aura-color': 'color-mix(in srgb, var(--color-electric) 60%, transparent)',
  },
  legendaria: {
    '--aura-color': 'var(--color-gold-aura)',
    backgroundImage:
      'linear-gradient(110deg, var(--color-surface-alt) 30%, color-mix(in srgb, var(--color-gold) 38%, var(--color-surface-alt)) 50%, var(--color-surface-alt) 70%)',
    backgroundSize: '240% 100%',
  },
}

/**
 * Contador de racha de la sesión estilo combo de juego de lucha, anclado al
 * borde superior derecho de la arena. Aparece con pop a partir del tercer
 * voto y hace tick en cada voto. Overlay absoluto con pointer-events-none:
 * no participa del layout (cero CLS al aparecer) ni intercepta clicks.
 */
const VoteStreakBadge = memo(function VoteStreakBadge({ total = 0 }) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  if (total < MIN_STREAK) return null
  const tier = getStreakTier(total)
  return (
    <div
      role="img"
      aria-label={t('votar.racha.aria', { total })}
      data-tier={tier}
      className="pointer-events-none absolute -top-2 right-1 z-30 rotate-2 sm:-top-3 sm:right-2"
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-black sm:text-[12px] ${TIER_CLASSES[tier]}`}
        style={TIER_STYLES[tier]}
      >
        <motion.span
          key={total}
          aria-hidden="true"
          className="block"
          initial={reduceMotion ? false : { scale: 1.3 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {t('votar.racha.etiqueta', { total })}
        </motion.span>
      </motion.div>
    </div>
  )
})

export default VoteStreakBadge
