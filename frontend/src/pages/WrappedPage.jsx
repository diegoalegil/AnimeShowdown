import { useQuery } from '@tanstack/react-query'
import { Navigate, Link } from 'react-router-dom'
import { Award, Sparkles, Swords, Target, Vote } from 'lucide-react'
import Avatar from '../components/Avatar'
import PersonajeImg from '../components/PersonajeImg'
import ShareButtons from '../components/ShareButtons'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import { endpoints } from '../lib/api'

const ESTADISTICAS = [
  { key: 'votosTotales', label: 'Votos emitidos', icon: Vote },
  { key: 'duelosJugados', label: 'Duelos jugados', icon: Swords },
  { key: 'prediccionesAcertadas', label: 'Predicciones acertadas', icon: Target },
  { key: 'badgesDesbloqueados', label: 'Logros desbloqueados', icon: Award },
]

function WrappedPage() {
  // Vista privada del propio usuario (datos personales) → noindex.
  useSeo({ title: 'Tu Wrapped', noindex: true })
  const { user } = useAuth()

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['wrapped'],
    queryFn: endpoints.miWrapped,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  })

  if (!user) return <Navigate to="/login" replace />

  const shareUrl = `${window.location.origin}/wrapped`
  const shareText = data
    ? `Mi AnimeShowdown Wrapped: ${data.votosTotales} votos${data.fandomPrincipal ? ` y mi fandom Nº1 es ${data.fandomPrincipal}` : ''}. ¿Y el tuyo?`
    : 'Mira tu AnimeShowdown Wrapped'

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6 text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-gold/12 px-3 py-1 text-[12px] font-bold text-gold">
          <Sparkles className="h-3.5 w-3.5" /> Tu Wrapped
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-fg-strong">
          Tu año en AnimeShowdown
        </h1>
        <p className="text-[13px] text-fg-muted">
          Un resumen de tu actividad real en la arena.
        </p>
      </header>

      {isPending ? (
        <p className="py-16 text-center text-[13px] text-fg-muted">Calculando tu resumen…</p>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-[13px] text-fg-muted">No pudimos cargar tu Wrapped.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-[13px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {/* Cabecera con identidad del usuario (aro de marco incluido). */}
          <div className="flex items-center gap-4 border-b border-border bg-gradient-to-br from-accent-soft to-surface p-6">
            <Avatar user={user} size={64} />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-fg-strong">@{data.username}</p>
              {data.fandomPrincipal && (
                <p className="truncate text-[13px] text-fg-muted">
                  Fandom Nº1: <span className="font-semibold text-fg-strong">{data.fandomPrincipal}</span>
                </p>
              )}
            </div>
          </div>

          {/* Cifras */}
          <div className="grid grid-cols-2 gap-px bg-border">
            {ESTADISTICAS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="bg-surface p-5">
                <Icon className="mb-2 h-5 w-5 text-accent-text" />
                <p className="text-2xl font-extrabold tabular-nums text-fg-strong">
                  {Number(data[key] ?? 0).toLocaleString('es')}
                </p>
                <p className="text-[12px] text-fg-muted">{label}</p>
              </div>
            ))}
          </div>

          {/* Personaje top */}
          {data.personajeTop && (
            <div className="flex items-center gap-4 border-t border-border p-6">
              <Link
                to={`/personajes/${data.personajeTop.slug}`}
                className="shrink-0 overflow-hidden rounded-xl border border-border"
              >
                <PersonajeImg
                  slug={data.personajeTop.slug}
                  nombre={data.personajeTop.nombre}
                  width={72}
                  height={72}
                  sizes="72px"
                  className="h-18 w-18"
                />
              </Link>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gold">
                  Tu personaje Nº1
                </p>
                <Link
                  to={`/personajes/${data.personajeTop.slug}`}
                  className="block truncate text-lg font-bold text-fg-strong hover:text-gold"
                >
                  {data.personajeTop.nombre}
                </Link>
                {data.personajeTop.anime && (
                  <p className="truncate text-[12px] text-fg-muted">{data.personajeTop.anime}</p>
                )}
              </div>
            </div>
          )}

          {/* Compartir */}
          <div className="border-t border-border p-6">
            <p className="mb-3 text-[13px] font-semibold text-fg-strong">
              Comparte tu Wrapped
            </p>
            <ShareButtons url={shareUrl} texto={shareText} />
          </div>
        </div>
      )}
    </main>
  )
}

export default WrappedPage
