import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { usePerfilActividad } from '../hooks/usePerfil'
import { ActividadItem } from './ActividadItem'

/**
 * Feed de actividad reciente del usuario en su perfil.
 *
 * <p>Mezcla votos, logros, torneos creados y predicciones acertadas en
 * orden temporal descendente. Reusa el renderer compartido ActividadItem
 * (sin autoría: es la actividad del propio usuario). El feed de comunidad
 * (/feed) usa el mismo componente con showAuthor para no duplicar el render.
 */
function CardActividadReciente() {
  const { data, isLoading, isError } = usePerfilActividad({ limit: 15 })

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">Actividad reciente</h2>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : isError ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-[13px] text-danger">
          No se pudo cargar tu actividad. Recarga la página.
        </p>
      ) : !data || data.length === 0 ? (
        <p className="text-[13px] text-fg-muted">
          Todavía no tienes actividad registrada. Empieza{' '}
          <Link to="/votar" className="text-gold hover:underline">
            votando un duelo
          </Link>{' '}
          o{' '}
          <Link to="/torneos/crear" className="text-gold hover:underline">
            creando un torneo
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.slice(0, 10).map((item, idx) => (
            <ActividadItem key={`${item.tipo}-${item.fecha}-${idx}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default CardActividadReciente
