import { Link } from 'react-router-dom'
import { Swords, Award, Trophy, Target } from 'lucide-react'
import Avatar from './Avatar'

// Helpers privados (no exportados): la regla react-refresh/only-export-components
// exige que este módulo solo EXPORTE componentes, así que configPorTipo y
// fechaRelativa quedan a nivel de módulo sin export.
function configPorTipo(item) {
  const p = item.payload || {}
  switch (item.tipo) {
    case 'VOTO':
      return {
        icon: Swords,
        color: 'bg-accent-soft text-gold',
        contenido: (
          <>
            Votó a{' '}
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
              <span className="text-fg-muted"> contra {p.oponenteNombre}</span>
            )}
          </>
        ),
      }
    case 'LOGRO':
      return {
        icon: Award,
        color: 'bg-gold/15 text-gold',
        contenido: (
          <>
            Desbloqueó{' '}
            <Link to="/logros" className="font-semibold text-fg-strong hover:underline">
              {p.nombre || 'un logro'}
            </Link>
          </>
        ),
      }
    case 'TORNEO_CREADO':
      return {
        icon: Trophy,
        color: 'bg-rarity-epic/15 text-rarity-epic',
        contenido: (
          <>
            Creó el torneo{' '}
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
          </>
        ),
      }
    case 'PREDICCION_ACERTADA':
      return {
        icon: Target,
        color: 'bg-success/15 text-success',
        contenido: (
          <>
            Acertó la predicción de{' '}
            <strong className="text-fg-strong">{p.personajeNombre}</strong>
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

/**
 * Renderer compartido de un item de actividad (B7 §2). Lo usan el feed
 * personal del perfil (CardActividadReciente, sin autor) y el feed de
 * comunidad (FeedPage, con showAuthor): si el payload trae autoría
 * (autorUsername), pinta el avatar + link del autor en vez del icono del tipo.
 *
 * Export ÚNICO con nombre (sin default) para no romper react-refresh.
 */
export function ActividadItem({ item, showAuthor = false }) {
  const config = configPorTipo(item)
  if (!config) return null
  const { icon: Icon, color, contenido } = config
  const p = item.payload || {}
  const autor = p.autorUsername

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-bg p-3">
      {showAuthor && autor ? (
        <Link to={`/u/${autor}`} className="shrink-0">
          <Avatar user={{ username: autor, avatarUrl: p.autorAvatarUrl }} size={28} />
        </Link>
      ) : (
        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${color}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-snug text-fg-strong">
          {showAuthor && autor ? (
            <>
              <Link
                to={`/u/${autor}`}
                className="font-semibold text-fg-strong hover:underline"
              >
                {autor}
              </Link>{' '}
            </>
          ) : null}
          {contenido}
        </div>
        <p className="mt-0.5 text-[11px] text-fg-muted">{fechaRelativa(item.fecha)}</p>
      </div>
    </li>
  )
}
