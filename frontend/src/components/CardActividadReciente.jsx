import { Link } from 'react-router-dom'
import { Activity, Award, Swords, Target, Trophy } from 'lucide-react'
import { usePerfilActividad } from '../hooks/usePerfil'

/**
 * Feed de actividad reciente del usuario.
 *
 * <p>Mezcla votos, logros, torneos creados y predicciones acertadas en
 * orden temporal descendente. Si está cargando muestra skeleton; si
 * está vacío invita a votar. Si hay datos, lista hasta 10 items con
 * icono, mensaje y tiempo relativo.
 */
function CardActividadReciente() {
  const { data, isLoading } = usePerfilActividad({ limit: 15 })

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">Actividad reciente</h2>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
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

function ActividadItem({ item }) {
  const config = configPorTipo(item)
  if (!config) return null
  const { icon: Icon, color, contenido } = config
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-bg p-3">
      <span
        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${color}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-snug text-fg-strong">{contenido}</div>
        <p className="mt-0.5 text-[11px] text-fg-muted">
          {fechaRelativa(item.fecha)}
        </p>
      </div>
    </li>
  )
}

function configPorTipo(item) {
  const p = item.payload || {}
  switch (item.tipo) {
    case 'VOTO':
      return {
        icon: Swords,
        color: 'bg-accent-soft text-gold',
        contenido: (
          <>
            Votaste a{' '}
            {p.personajeSlug ? (
              <Link
                to={`/personajes/${p.personajeSlug}`}
                className="font-semibold text-fg-strong hover:underline"
              >
                {p.personajeNombre}
              </Link>
            ) : (
              <strong>{p.personajeNombre || 'un personaje'}</strong>
            )}
            {p.oponenteNombre && (
              <>
                {' '}
                <span className="text-fg-muted">contra {p.oponenteNombre}</span>
              </>
            )}
            {p.torneoNombre && p.torneoSlug && (
              <>
                {' · '}
                <Link
                  to={`/torneos/${p.torneoSlug}`}
                  className="text-fg-muted hover:underline"
                >
                  {p.torneoNombre}
                </Link>
              </>
            )}
          </>
        ),
      }
    case 'LOGRO':
      return {
        icon: Award,
        color: 'bg-amber-500/15 text-amber-300',
        contenido: (
          <>
            Desbloqueaste{' '}
            <Link to="/logros" className="font-semibold text-fg-strong hover:underline">
              {p.nombre || 'un logro'}
            </Link>
          </>
        ),
      }
    case 'TORNEO_CREADO':
      return {
        icon: Trophy,
        color: 'bg-fuchsia-500/15 text-fuchsia-300',
        contenido: (
          <>
            Creaste el torneo{' '}
            {p.torneoSlug ? (
              <Link
                to={`/torneos/${p.torneoSlug}`}
                className="font-semibold text-fg-strong hover:underline"
              >
                {p.torneoNombre}
              </Link>
            ) : (
              <strong>{p.torneoNombre || 'sin nombre'}</strong>
            )}
            {p.estadoRevision && p.estadoRevision !== 'NO_APLICA' && (
              <span className="ml-1.5 text-fg-muted">· {p.estadoRevision.toLowerCase()}</span>
            )}
          </>
        ),
      }
    case 'PREDICCION_ACERTADA':
      return {
        icon: Target,
        color: 'bg-emerald-500/15 text-emerald-300',
        contenido: (
          <>
            Acertaste predicción:{' '}
            <strong className="text-fg-strong">{p.personajeNombre}</strong>
            {p.torneoNombre && p.torneoSlug && (
              <>
                {' '}
                <Link
                  to={`/torneos/${p.torneoSlug}`}
                  className="text-fg-muted hover:underline"
                >
                  · {p.torneoNombre}
                </Link>
              </>
            )}
          </>
        ),
      }
    default:
      return null
  }
}

function fechaRelativa(iso) {
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''
  const diffMin = Math.round((Date.now() - ts) / 60000)
  if (diffMin < 1) return 'hace un instante'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `hace ${diffH} h`
  const diffD = Math.round(diffH / 24)
  if (diffD === 1) return 'ayer'
  if (diffD < 30) return `hace ${diffD} días`
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default CardActividadReciente
