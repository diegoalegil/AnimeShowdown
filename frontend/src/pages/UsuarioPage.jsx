import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { AlertTriangle, Settings, UserMinus, UserPlus } from 'lucide-react'
import { AppLink } from '../components/AppLink'
import CardLogros from '../components/CardLogros'
import CardDanKyu from '../components/CardDanKyu'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { usePerfilPublico, useToggleSeguir } from '../hooks/usePerfil'
import MissingFighter from '../features/perfil/MissingFighter'
import FighterProfile from '../features/perfil/FighterProfile'
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
 * Perfil público de cualquier usuario — «La Ficha del Combatiente».
 *
 * Ruta: /u/:username. Endpoint backend permitAll así que se ve sin login,
 * pero si hay sesión los flags `siguiendo` y `esMismoUsuario` permiten
 * pintar el botón Follow / el atajo a editar el perfil propio.
 *
 * Layout: FighterProfile (estandarte + avatar con marco + KPIs acuñados +
 * vitrina top5/medallas) → Dan/Kyu → catálogo completo de logros. La
 * edición vive en /perfil (no se duplica aquí).
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
      <section className="mx-auto grid w-full max-w-4xl gap-4 px-5 py-12">
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
    // Señal perdida: el 404 como transmisión interrumpida del archivo (el
    // noindex ya quedó puesto arriba por useSeo).
    return <MissingFighter username={username} />
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

  const accionPrincipal = perfil.esMismoUsuario ? (
    <AppLink to="/perfil" className="fp-tablilla">
      <Settings className="h-3.5 w-3.5" />
      Editar perfil
    </AppLink>
  ) : (
    <BotonSeguir
      perfil={perfil}
      onToggle={handleToggle}
      pending={toggleSeguir.isPending}
      userLogueado={Boolean(user)}
    />
  )

  return (
    <VisualPageShell visual={BRAND_VISUALS.usuarioHero} contentClassName="mx-auto max-w-4xl" density="low" lateralKanji={{left: "客", right: "人"}}>
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
          <FighterProfile
            perfil={perfil}
            esPropio={Boolean(perfil.esMismoUsuario)}
            accionPrincipal={accionPrincipal}
            hrefPersonaje={(slug) => `/personajes/${slug}`}
          />
          <CardDanKyu data={perfil.stats} />
          <CardLogros
            data={perfil.logros}
            mensajeIntro={`Los logros que ${perfil.username} ha conseguido. En gris los que aún le faltan.`}
          />
        </motion.div>
    </VisualPageShell>
  )
}

function BotonSeguir({ perfil, onToggle, pending, userLogueado }) {
  const { siguiendo } = perfil
  return (
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
  )
}

export default UsuarioPage
