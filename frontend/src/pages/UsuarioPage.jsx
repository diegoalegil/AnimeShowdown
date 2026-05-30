import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { AlertTriangle, CalendarDays, UserMinus, UserPlus, Users, UserCheck } from 'lucide-react'
import Avatar from '../components/Avatar'
import CardStats from '../components/CardStats'
import CardTop5 from '../components/CardTop5'
import CardLogros from '../components/CardLogros'
import CardDanKyu from '../components/CardDanKyu'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { usePerfilPublico, useToggleSeguir } from '../hooks/usePerfil'
import { ApiError } from '../lib/api'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

/**
 * Perfil público de cualquier usuario.
 *
 * Ruta: /u/:username. Endpoint backend permitAll así que se ve sin login,
 * pero si hay sesión los flags `siguiendo` y `esMismoUsuario` permiten
 * pintar el botón Follow / Dejar de seguir.
 *
 * Layout: header horizontal (avatar + datos + Follow) → stats → top5 →
 * logros con catálogo completo y locked. Sin historial detallado de
 * votos — eso queda en /perfil del propio user.
 */
function UsuarioPage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: perfil, isLoading, error } = usePerfilPublico(username)
  const toggleSeguir = useToggleSeguir(username)

  // useSeo después de la query: cuando llega `perfil` el effect se vuelve
  // a disparar y los meta tags se enriquecen con counts y avatar. Mientras
  // tanto, el title genérico cubre el periodo de loading.
  useSeo({
    title: username ? `Perfil de ${username}` : 'Perfil',
    description: perfil
      ? `Perfil público de ${username} en AnimeShowdown · ${perfil.seguidores ?? 0} seguidores · ${perfil.stats?.votosTotales ?? 0} votos · top personajes y logros.`
      : `Perfil público de ${username} en AnimeShowdown.`,
    image: perfil?.avatarUrl || undefined,
    type: 'profile',
    // Marcamos noindex en 404 para que Google no indexe la URL inexistente
    // con la copia de "Usuario no encontrado".
    noindex: error?.status === 404,
  })

  if (isLoading) {
    return (
      <section className="mx-auto grid w-full max-w-2xl gap-4 px-5 py-12">
        <Skeleton variant="banner" />
        <Skeleton variant="line" className="h-20 w-full rounded-lg" />
        <Skeleton variant="line" className="h-20 w-full rounded-lg" />
      </section>
    )
  }

  if (error && error.status !== 404) {
    return (
      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar el perfil"
          description={error?.message || 'Reintenta en unos segundos para volver a consultar el perfil público.'}
        />
      </section>
    )
  }

  if (error?.status === 404 || !perfil) {
    return (
      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-bold tracking-tight text-fg-strong">
            Usuario no encontrado
          </h1>
          <p className="mt-3 text-fg-muted">
            No existe ningún usuario con el username{' '}
            <code className="rounded-md bg-surface px-1.5 py-0.5 text-[13px]">
              {username}
            </code>
            .
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-fg-strong transition-colors hover:border-accent/40"
          >
            Volver al inicio
          </button>
        </div>
      </section>
    )
  }

  const handleToggle = async () => {
    if (!user) {
      navigate(`/login?next=/u/${username}`)
      return
    }
    try {
      await toggleSeguir.mutateAsync({
        usuarioId: perfil.id,
        siguiendo: Boolean(perfil.siguiendo),
      })
      toast.success(
        perfil.siguiendo
          ? `Ya no sigues a ${perfil.username}`
          : `Ahora sigues a ${perfil.username}`,
      )
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo conectar al servidor.'
      toast.error('No se pudo actualizar el seguimiento', { description: msg })
    }
  }

  return (
    <VisualPageShell visual={BRAND_VISUALS.usuarioHero} contentClassName="mx-auto max-w-2xl" density="low" lateralKanji={{left: "客", right: "人"}}>
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: perfil.username, path: `/u/${perfil.username}` },
        ])}
      />
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="grid gap-6"
        >
          <HeaderCard
            perfil={perfil}
            onToggle={handleToggle}
            pending={toggleSeguir.isPending}
            userLogueado={Boolean(user)}
          />
          <CardStats data={perfil.stats} />
          <CardDanKyu data={perfil.stats} />
          <CardTop5
            data={perfil.top}
            titulo={`Top 5 de ${perfil.username}`}
            mensajeIntro={`Los personajes a los que ${perfil.username} más ha votado.`}
            mensajeVacio={`${perfil.username} todavía no ha votado a ningún personaje.`}
          />
          <CardLogros
            data={perfil.logros}
            mensajeIntro={`Los logros que ${perfil.username} ha conseguido. En gris los que aún le faltan.`}
          />
        </motion.div>
    </VisualPageShell>
  )
}

function mesAlta(fechaRegistro) {
  if (!fechaRegistro) return null
  const d = new Date(fechaRegistro)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(d)
}

function HeaderCard({ perfil, onToggle, pending, userLogueado }) {
  const { esMismoUsuario, siguiendo } = perfil
  const desde = mesAlta(perfil.fechaRegistro)
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-start gap-5">
        <Avatar user={perfil} size={80} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="truncate text-2xl font-bold tracking-tight text-fg-strong">
            {perfil.username}
          </h1>
          <div className="flex flex-wrap gap-4 text-[13px] text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <strong className="font-semibold tabular-nums text-fg-strong">
                {perfil.seguidores}
              </strong>{' '}
              seguidores
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" />
              <strong className="font-semibold tabular-nums text-fg-strong">
                {perfil.seguidos}
              </strong>{' '}
              seguidos
            </span>
            {desde && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                miembro desde {desde}
              </span>
            )}
          </div>
          {perfil.bio && (
            <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-fg-muted">
              {perfil.bio}
            </p>
          )}
        </div>
        {!esMismoUsuario && (
          <button
            type="button"
            onClick={onToggle}
            disabled={pending}
            aria-label={
              siguiendo
                ? `Dejar de seguir a ${perfil.username}`
                : `Seguir a ${perfil.username}`
            }
            className={
              siguiendo
                ? 'inline-flex shrink-0 items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60'
                : 'inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60'
            }
          >
            {siguiendo ? (
              <>
                <UserMinus className="h-4 w-4" />
                {pending ? 'Quitando…' : 'Dejar de seguir'}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                {pending
                  ? 'Siguiendo…'
                  : userLogueado
                    ? 'Seguir'
                    : 'Entrar para seguir'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default UsuarioPage
