import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Trophy, ArrowLeft } from 'lucide-react'
import Avatar from '../components/Avatar'
import BadgeCardCatalogo from '../components/BadgeCardCatalogo'
import EmptyState from '../components/EmptyState'
import Skeleton from '../components/Skeleton'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { usePerfilPublico } from '../hooks/usePerfil'
import { useStatsLogros } from '../hooks/useLogros'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const FILTROS_RAREZA = [
  { value: null, label: 'Todos' },
  { value: 5, label: 'Legendarios' },
  { value: 4, label: 'Épicos' },
  { value: 3, label: 'Raros' },
  { value: 2, label: 'Poco comunes' },
  { value: 1, label: 'Comunes' },
]

/**
 * Perfil público de logros.
 *
 * Ruta: /u/:username/logros. Reutiliza el endpoint /api/perfil/{username}
 * que ya devuelve el campo `logros` (catálogo enriquecido con desbloqueadoEn
 * del usuario target). Misma vista que /logros pero con datos del usuario
 * concreto + header con avatar + link al perfil completo.
 */
function UsuarioLogrosPage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const { data: perfil, isLoading, error } = usePerfilPublico(username)
  const { data: stats } = useStatsLogros()
  const [filtroRareza, setFiltroRareza] = useState(null)

  const logros = useMemo(() => perfil?.logros ?? [], [perfil?.logros])
  const total = logros.length
  const desbloqueados = logros.filter((l) => l.desbloqueadoEn).length

  const visibles = useMemo(() => {
    const filtrados =
      filtroRareza == null
        ? logros
        : logros.filter((l) => l.rareza === filtroRareza)
    return [...filtrados].sort((a, b) => {
      // Desbloqueados primero, luego por rareza desc, luego alfabético.
      if (Boolean(a.desbloqueadoEn) !== Boolean(b.desbloqueadoEn)) {
        return a.desbloqueadoEn ? -1 : 1
      }
      if (b.rareza !== a.rareza) return (b.rareza ?? 0) - (a.rareza ?? 0)
      // locale dinámico, antes 'es' hardcoded.
      return a.nombre.localeCompare(b.nombre, i18n.language || undefined)
    })
  }, [logros, filtroRareza, i18n.language])

  useSeo({
    title: username ? `Logros de ${username}` : 'Logros',
    description: perfil
      ? `Los ${desbloqueados} logros desbloqueados de ${username} en AnimeShowdown — votos, predicciones, torneos y rachas diarias.`
      : `Logros desbloqueados de ${username} en AnimeShowdown.`,
    image: perfil?.avatarUrl || undefined,
    noindex: error?.status === 404,
  })

  if (isLoading) {
    return (
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-5 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </section>
    )
  }

  if (error && error.status !== 404) {
    return (
      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar estos logros"
          description={error?.message || 'Reintenta en unos segundos para volver a consultar el perfil.'}
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
            <code className="rounded bg-surface px-1.5 py-0.5 text-[13px]">
              {username}
            </code>
            .
          </p>
          <button
            type="button"
            onClick={() => navigate('/logros')}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-fg-strong transition-colors hover:border-accent/40"
          >
            Ver catálogo de logros
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: perfil.username, path: `/u/${perfil.username}` },
          { label: 'Logros', path: `/u/${perfil.username}/logros` },
        ])}
      />
      <div className="mx-auto max-w-6xl">
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <Link
            to={`/u/${perfil.username}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted transition-colors hover:text-fg-strong"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver al perfil de {perfil.username}
          </Link>
          <div className="flex items-start gap-5">
            <Avatar user={perfil} size={72} />
            <div className="flex flex-col gap-1.5">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
                <Trophy className="h-3 w-3 text-amber-400" />
                勲章 · Logros
              </span>
              <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-tight">
                Logros de {perfil.username}
              </h1>
              <p className="text-fg-muted">
                <strong className="font-semibold text-fg-strong tabular-nums">
                  {desbloqueados} / {total}
                </strong>{' '}
                desbloqueados en AnimeShowdown.
              </p>
            </div>
          </div>
        </motion.header>

        <div className="mb-6 flex flex-wrap gap-1.5">
          {FILTROS_RAREZA.map((f) => {
            const n =
              f.value == null
                ? total
                : logros.filter((l) => l.rareza === f.value).length
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setFiltroRareza(f.value)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  filtroRareza === f.value
                    ? 'bg-accent text-bg'
                    : 'border border-border bg-surface text-fg-muted hover:text-fg-strong'
                }`}
              >
                {f.label} ({n})
              </button>
            )
          })}
        </div>

        {visibles.length === 0 ? (
          <EmptyState scene
            icon={Trophy}
            title="Sin logros en esta rareza"
          >
            <p>
              Prueba otra rareza o vuelve al listado completo de logros del
              perfil.
            </p>
            {filtroRareza != null && (
              <button
                type="button"
                onClick={() => setFiltroRareza(null)}
                className="as-button-primary mt-3 rounded-lg px-5 py-3 text-sm font-black"
              >
                Limpiar filtro
              </button>
            )}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.map((l) => (
              <BadgeCardCatalogo
                key={l.codigo}
                logro={l}
                count={stats?.[l.codigo] ?? 0}
              />
            ))}
          </div>
        )}

        <div className="mt-10 rounded-xl border border-border bg-surface p-5">
          <p className="text-[13px] text-fg-muted">
            ¿Quieres ver el catálogo completo de los logros que puedes
            desbloquear?{' '}
            <Link to="/logros" className="text-gold hover:underline">
              Ir al catálogo
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  )
}

export default UsuarioLogrosPage
