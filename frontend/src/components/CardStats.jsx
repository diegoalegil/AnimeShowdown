import { Activity, Award, Swords, Target, Vote } from 'lucide-react'
import { usePerfilStats } from '../hooks/usePerfil'
import KanjiSpinner from './KanjiSpinner'

/**
 * Card "Estadísticas" del perfil.
 *
 * 4 KPIs en grid: votos totales, predicciones acertadas, % aciertos,
 * badges desbloqueados. Si no hay datos aún (user nuevo), se muestran
 * con valor 0 sin estados raros.
 *
 * <p>Modos de uso:
 * <ul>
 *   <li>Sin props: usa el hook {@code usePerfilStats} y muestra los
 *       stats del usuario autenticado (perfil propio).</li>
 *   <li>Con prop {@code data}: pinta lo que le pasen — usado por
 *       {@code UsuarioPage} para mostrar stats de cualquier user
 *       desde la respuesta agregada de {@code /api/perfil/{username}}.</li>
 * </ul>
 */
function CardStats({ data: dataProp = null }) {
  const enabled = dataProp === null
  const { data: dataHook, isLoading: isLoadingHook } = usePerfilStats({
    enabled,
  })
  const data = dataProp ?? dataHook
  const isLoading = dataProp === null && isLoadingHook
  const stats = data ?? {
    votosTotales: 0,
    prediccionesAcertadas: 0,
    prediccionesResueltas: 0,
    porcentajeAciertos: 0,
    badgesDesbloqueados: 0,
    torneosCreados: 0,
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">Estadísticas</h2>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <KanjiSpinner size="sm" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi
            icon={Vote}
            label="Votos totales"
            value={stats.votosTotales}
          />
          <Kpi
            icon={Target}
            label="Predicciones OK"
            value={`${stats.prediccionesAcertadas}/${stats.prediccionesResueltas}`}
          />
          <Kpi
            icon={Target}
            label="% Aciertos"
            value={`${stats.porcentajeAciertos}%`}
            accent
          />
          <Kpi
            icon={Award}
            label="Logros"
            value={`${stats.badgesDesbloqueados}/14`}
          />
          <Kpi
            icon={Swords}
            label="Torneos creados"
            value={stats.torneosCreados ?? 0}
          />
        </div>
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, accent = false }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-3">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span
        className={`text-xl font-bold tabular-nums ${
          accent ? 'text-gold' : 'text-fg-strong'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

export default CardStats
