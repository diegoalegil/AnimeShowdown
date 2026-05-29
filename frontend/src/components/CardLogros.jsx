import { ArrowRight, Share2, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMisLogros } from '../hooks/useLogros'
import { useAuth } from '../contexts/AuthContext'
import KanjiSpinner from './KanjiSpinner'
import BadgeCard from './BadgeCard'

/**
 * Sección "Logros" del perfil.
 *
 * Card con header "X / 14 desbloqueados" + grid responsive de badges.
 * En mobile el grid pasa a 4 columnas para que cada badge mantenga
 * tamaño legible; en desktop son 7 columnas (14 / 2 filas).
 *
 * <p>Sin props usa {@code useMisLogros} (catálogo + desbloqueos del
 * usuario autenticado). Con prop {@code data} pinta lo que le pasen —
 * usado en perfil público con los logros de otro usuario.
 */
function CardLogros({
  data: dataProp = null,
  titulo = 'Logros',
  mensajeIntro = 'Cada acción importante en AnimeShowdown desbloquea un logro. Vota, predice y completa torneos para coleccionarlos todos.',
}) {
  const enabled = dataProp === null
  const { data: dataHook, isLoading: isLoadingHook } = useMisLogros({
    enabled,
  })
  const { user } = useAuth()
  const logros = dataProp ?? dataHook
  const isLoading = dataProp === null && isLoadingHook
  const mostrarFooter = dataProp === null && Boolean(user?.username)

  const total = logros?.length ?? 0
  const desbloqueados = logros?.filter((l) => l.desbloqueadoEn).length ?? 0

  return (
    <div className="pattern-overlay pattern-overlay-seigaiha rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">{titulo}</h2>
        {!isLoading && (
          <span className="ml-auto inline-flex rounded-full border border-border bg-bg px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-fg-muted">
            {desbloqueados} / {total}
          </span>
        )}
      </div>
      <p className="mb-5 text-[12px] text-fg-muted">{mensajeIntro}</p>
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <KanjiSpinner size="sm" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-7">
          {logros.map((l) => (
            <BadgeCard key={l.codigo} logro={l} />
          ))}
        </div>
      )}
      {mostrarFooter && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-[11px] text-fg-muted">
            Comparte tu colección con otros usuarios.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/logros"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-1.5 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
            >
              Ver catálogo completo
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              to={`/u/${user.username}/logros`}
              className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-3 py-1.5 text-[12px] font-semibold text-gold transition-colors hover:bg-accent/15"
            >
              <Share2 className="h-3 w-3" />
              Mi perfil público
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default CardLogros
