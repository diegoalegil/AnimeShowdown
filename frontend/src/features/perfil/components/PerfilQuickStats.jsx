import { motion } from 'framer-motion'
import { Award, Swords, Target, Trophy, Vote } from 'lucide-react'
import { usePerfilStats } from '../../../hooks/usePerfil'
import { rangoDe } from '../../../lib/danKyu'

/**
 * Quick stats del perfil: votos, predicciones, badges + rango actual.
 *
 * Antes el usuario tenia que entrar en Resumen para ver Dan/Kyu, hacer
 * scroll para ver actividad, navegar a Logros para badges, etc. Esto
 * pone las 4 metricas clave arriba de los tabs.
 *
 * Skeletons mientras carga el query. Si no hay sesion/stats, se omite
 * silenciosamente (return null) — el resto del perfil sigue siendo util.
 */
function PerfilQuickStats() {
  const { data: stats, isLoading } = usePerfilStats()
  if (isLoading) {
    return (
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-shimmer rounded-xl border border-border bg-gradient-to-r from-surface/40 via-surface/70 to-surface/40 bg-[length:200%_100%]"
          />
        ))}
      </div>
    )
  }
  if (!stats) return null

  const puntos =
    (stats.votos ?? 0) * 2 +
    (stats.predicciones ?? 0) * 5 +
    (stats.badges ?? 0) * 20
  const { actual } = rangoDe(puntos)
  const tiles = [
    {
      icon: Vote,
      valor: stats.votos ?? 0,
      label: 'Votos emitidos',
      cls: 'text-danger border-danger/30 bg-danger/5',
    },
    {
      icon: Target,
      valor: stats.predicciones ?? 0,
      label: 'Predicciones',
      cls: 'text-success border-success/30 bg-success/5',
    },
    {
      icon: Trophy,
      valor: stats.badges ?? 0,
      label: 'Logros',
      cls: 'text-gold border-gold/30 bg-gold/5',
    },
    {
      icon: Swords,
      valor: stats.eloPvp ?? 1000,
      label: 'ELO PvP',
      cls: 'text-electric border-electric/30 bg-electric/5',
    },
    {
      icon: Award,
      valor: actual.nombre,
      label: 'Rango actual',
      cls: 'text-rarity-epic border-rarity-epic/30 bg-rarity-epic/5',
      strong: true,
    },
  ]

  return (
    <motion.div
      className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`flex items-center gap-2.5 rounded-xl border bg-surface/40 p-4 backdrop-blur-sm ${t.cls}`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg/30">
            <t.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div
              className={`tabular-nums text-fg-strong ${t.strong ? 'truncate text-base font-bold' : 'text-2xl font-black'}`}
              title={t.strong ? String(t.valor) : undefined}
            >
              {t.valor}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              {t.label}
            </p>
          </div>
        </div>
      ))}
    </motion.div>
  )
}

export default PerfilQuickStats
