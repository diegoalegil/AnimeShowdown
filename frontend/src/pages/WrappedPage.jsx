import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import { endpoints } from '../lib/api'
import { slugifyAnime } from '../lib/animes'
import { recordDailyShare } from '../lib/dailyProgress'
import WrappedSanctuary from '../features/wrapped-sanctuary/WrappedSanctuary'

// Evaluada una vez al cargar el módulo (fuera de render — purity).
const TEMPORADA = String(new Date().getFullYear())
const TEMPORADA_NUM = Number(TEMPORADA)

/**
 * Tu Wrapped — el santuario de tu temporada.
 *
 * <p>El éxito renderiza «El santuario del Wrapped» (WrappedSanctuary): un
 * peregrinaje de scroll vertical por SALAS, una por estadística real de
 * endpoints.miWrapped. La pieza pinta el DOM; el padre (esta página) exporta la
 * tarjeta 1080×1920 compartible reutilizando el MISMO pintor canvas del Wrapped
 * anterior (../features/wrapped/wrapped-story-card). La scene de marca se
 * resuelve con slugifyAnime(fandomPrincipal) contra el banco de marca.
 *
 * <p>El DTO no trae el año (las cifras son acumuladas); lo inyecta esta página
 * con TEMPORADA (calculada una vez al cargar el módulo) para que el santuario
 * acuñe la temporada sin Date.now()/new Date() en render.
 *
 * <p>Vista privada del propio usuario → noindex.
 */
function WrappedPage() {
  useSeo({ title: 'Tu Wrapped', noindex: true })
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['wrapped'],
    queryFn: endpoints.miWrapped,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  })

  if (!user) return <Navigate to="/login" replace />

  if (data) {
    // El santuario lee `wrapped.anio`; el DTO no lo trae (cifras acumuladas),
    // así que lo inyectamos con la temporada calculada al cargar el módulo.
    const wrapped = { ...data, anio: TEMPORADA_NUM }
    const fandomSlug = data.fandomPrincipal ? slugifyAnime(data.fandomPrincipal) : null

    // onCompartir: PARIDAD con el FinalChapter del Wrapped anterior. La pieza
    // pinta el DOM; aquí exportamos la story-card 1080×1920 reutilizando el
    // MISMO pintor canvas (paintWrappedStoryCard) sobre un <canvas> offscreen y
    // la compartimos (Web Share API con fallback a descarga). cardData = el
    // mismo mapeo que pasaba FinalChapter, ahora desde el DTO real.
    const compartir = async () => {
      const cardData = {
        username: data.username,
        temporada: TEMPORADA,
        kanji: '戦',
        fandomPrincipal: data.fandomPrincipal ?? null,
        personajeTop: data.personajeTop ?? null,
        sceneUrl: fandomSlug
          ? `https://assets.animeshowdown.dev/img/brand/${fandomSlug}-scene-01-1280.webp`
          : null,
        votosTotales: data.votosTotales,
        duelosJugados: data.duelosJugados,
        prediccionesAcertadas: data.prediccionesAcertadas,
        badgesDesbloqueados: data.badgesDesbloqueados,
      }
      const mod = await import('../features/wrapped/wrapped-story-card')
      const canvas = document.createElement('canvas')
      await mod.paintWrappedStoryCard(canvas, cardData)
      const shareText = `Mi AnimeShowdown Wrapped: ${data.votosTotales} votos${
        data.fandomPrincipal ? ` y mi fandom Nº1 es ${data.fandomPrincipal}` : ''
      }. ¿Y el tuyo?`
      const result = await mod.shareWrappedStoryCard(canvas, {
        title: 'Mi AnimeShowdown Wrapped',
        text: shareText,
      })
      if (result === 'shared' || result === 'downloaded') recordDailyShare()
    }

    return (
      <WrappedSanctuary
        wrapped={wrapped}
        onCompartir={compartir}
        onVolverArena={() => navigate('/votar')}
      />
    )
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
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
      ) : null}
    </main>
  )
}

export default WrappedPage
