import { Trophy } from 'lucide-react'
import { useMisLogros } from '../hooks/useLogros'
import BadgeCard from './BadgeCard'

/**
 * Sección "Logros" del perfil (Plan v2 §4.2).
 *
 * Card con header "X / 14 desbloqueados" + grid responsive de badges.
 * En mobile el grid pasa a 4 columnas para que cada badge mantenga
 * tamaño legible; en desktop son 7 columnas (14 / 2 filas).
 */
function CardLogros() {
  const { data: logros, isLoading } = useMisLogros()

  const total = logros?.length ?? 0
  const desbloqueados = logros?.filter((l) => l.desbloqueadoEn).length ?? 0

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h2 className="text-lg font-bold text-fg-strong">Logros</h2>
        {!isLoading && (
          <span className="ml-auto inline-flex rounded-full border border-border bg-bg px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-fg-muted">
            {desbloqueados} / {total}
          </span>
        )}
      </div>
      <p className="mb-5 text-[12px] text-fg-muted">
        Cada acción importante en AnimeShowdown desbloquea un logro. Vota,
        predice y completa torneos para coleccionarlos todos.
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-7">
          {logros.map((l) => (
            <BadgeCard key={l.codigo} logro={l} />
          ))}
        </div>
      )}
    </div>
  )
}

export default CardLogros
