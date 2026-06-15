import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Swords } from 'lucide-react'
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
 * ¿El wrapped está a cero? Una cuenta recién creada (sin votos, sin duelos,
 * sin badges, sin top3 ni personaje) no tiene santuario que recorrer: las
 * salas se omiten una a una y el peregrinaje queda en entrada + emaki vacíos,
 * lo cual desanima en lugar de invitar. Detectamos ese caso para mostrar un
 * onboarding honesto y alentador en su lugar.
 * @param {object} w wrapped (shape de /api/wrapped/me)
 */
function esWrappedVacio(w) {
  return (
    (w?.votosTotales ?? 0) === 0 &&
    (w?.duelosJugados ?? 0) === 0 &&
    (w?.badgesDesbloqueados ?? 0) === 0 &&
    !(Array.isArray(w?.top3) && w.top3.length) &&
    !w?.personajeTop
  )
}

/* ── Onboarding del Wrapped a cero. Componente a nivel de módulo (regla
      react-refresh: los .jsx solo exportan componentes estables). ── */
function WrappedEmptyState({ username }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-5 py-20 text-center">
      <span lang="ja" className="font-kanji-serif text-[clamp(3rem,12vw,5rem)] leading-none text-gold/80">
        始
      </span>
      <h1 className="mt-5 text-[clamp(1.75rem,6vw,2.6rem)] font-extrabold leading-tight tracking-tight text-fg-strong">
        Tu temporada acaba de empezar
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-7 text-fg-muted">
        {username ? `@${username}, ` : ''}aún no hay cifras que acuñar en tu santuario. Vota
        tu primer duelo y empieza a escribir el emaki de tu temporada {TEMPORADA}.
      </p>
      <Link
        to="/votar"
        className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-gold bg-gradient-to-b from-accent-hover to-accent px-6 text-[15px] font-bold text-fg-strong transition-transform hover:-translate-y-0.5"
      >
        <Swords className="h-4 w-4" aria-hidden="true" />
        Vota tu primer duelo
      </Link>
    </main>
  )
}

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

  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['wrapped'],
    queryFn: endpoints.miWrapped,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  })

  // Opt-in público: persiste el flag y refresca la caché con el DTO devuelto
  // (trae `publico` ya actualizado), así el toggle refleja el nuevo estado.
  const togglePublico = useMutation({
    mutationFn: (next) => endpoints.setWrappedPublico(next),
    onSuccess: (actualizado) => queryClient.setQueryData(['wrapped'], actualizado),
  })

  // Llega aquí muchas veces vía un link viral del Wrapped de otro fan. No
  // perdamos ese visitante: arrastramos el next para que, tras entrar, vuelva
  // a /wrapped (LoginPage ya honra ?next= anti open-redirect).
  if (!user) return <Navigate to="/login?next=%2Fwrapped" replace />

  if (data) {
    // Cuenta recién creada (todo a cero) → onboarding alentador en vez del
    // santuario vacío. Honesto: no inventamos cifras, invitamos a empezar.
    if (esWrappedVacio(data)) return <WrappedEmptyState username={data.username} />

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
      // Identity-first: el share abre con quién eres (oshi/fandom), no con un
      // número frío. La cifra de votos cierra como prueba, no como gancho.
      const oshiNombre = data.personajeTop?.nombre ?? null
      const identidad = oshiNombre
        ? `Mi oshi Nº1 es ${oshiNombre}`
        : data.fandomPrincipal
          ? `Mi fandom Nº1 es ${data.fandomPrincipal}`
          : null
      const extraFandom =
        oshiNombre && data.fandomPrincipal ? ` y mi fandom Nº1 es ${data.fandomPrincipal}` : ''
      const shareText = identidad
        ? `${identidad}${extraFandom}. Mi AnimeShowdown Wrapped: ${data.votosTotales} votos. ¿Y el tuyo?`
        : `Mi AnimeShowdown Wrapped: ${data.votosTotales} votos. ¿Y el tuyo?`
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
        publico={Boolean(data.publico)}
        onTogglePublico={() => togglePublico.mutate(!data.publico)}
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
