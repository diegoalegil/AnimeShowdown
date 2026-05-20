import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Trophy, Users, ArrowRight } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, logrosCollectionSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { useAuth } from '../contexts/AuthContext'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import {
  useCatalogoLogros,
  useMisLogros,
  useStatsLogros,
} from '../hooks/useLogros'
import BadgeCardCatalogo from '../components/BadgeCardCatalogo'

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
 * Catálogo público de logros (Plan v2 §4.10).
 *
 * <p>Página pública que lista los 14 badges con descripción, rareza y
 * count comunidad ("X usuarios lo tienen"). Si el visitante está logueado,
 * los desbloqueados se marcan con check + glow accent.
 *
 * <p>Sirve dos propósitos:
 *   - SEO/GEO: añade una página indexable con datos extraíbles
 *     (Achievement schema) para crawlers y LLMs.
 *   - Gamificación: el visitante anónimo ve qué se puede conseguir antes
 *     de registrarse; el logueado ve qué le falta.
 */
function LogrosPage() {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const { data: catalogo, isLoading: cargandoCatalogo } = useCatalogoLogros()
  const { data: mios } = useMisLogros({ enabled: Boolean(user) })
  const { data: stats } = useStatsLogros()

  const [filtroRareza, setFiltroRareza] = useState(null)

  // Cuando hay sesión usamos /mios (incluye desbloqueadoEn por logro).
  // Sin sesión, el catálogo plano basta — todos los badges en modo "cómo
  // conseguirlo".
  const fuente = user ? mios : catalogo

  const visibles = useMemo(() => {
    if (!fuente) return []
    const filtrados =
      filtroRareza == null
        ? fuente
        : fuente.filter((l) => l.rareza === filtroRareza)
    // Ordena por rareza desc (legendarios primero) y luego alfabético.
    return [...filtrados].sort((a, b) => {
      if (b.rareza !== a.rareza) return (b.rareza ?? 0) - (a.rareza ?? 0)
      // Audit (2026-05-17): locale dinámico segun el idioma activo en
      // i18n, no hardcoded 'es'. Si el user cambia a EN, ordena con
      // collation inglés (los acentos y ñ rankean distinto).
      return a.nombre.localeCompare(b.nombre, i18n.language || undefined)
    })
  }, [fuente, filtroRareza, i18n.language])

  const total = catalogo?.length ?? 14
  const desbloqueados = mios?.filter((l) => l.desbloqueadoEn).length ?? 0
  const logroDestacado = searchParams.get('logro')

  useEffect(() => {
    if (!logroDestacado || visibles.length === 0) return undefined
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`logro-${logroDestacado}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [logroDestacado, visibles.length])

  useSeo({
    title: 'Logros desbloqueables',
    description: `Los ${total} logros que puedes desbloquear en AnimeShowdown — votos, predicciones, torneos y rachas diarias. Cada uno con su rareza y cuántos usuarios lo han conseguido.`,
  })

  return (
    <VisualPageShell visual={BRAND_VISUALS.ranking} contentClassName="mx-auto max-w-6xl" lateralKanji={{left: "勲", right: "章"}} atmosphere="tribute">
      {catalogo && (
        <JsonLd id="logros-collection" schema={logrosCollectionSchema(catalogo)} />
      )}
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Logros', path: '/logros' },
        ])}
      />
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Acento oro místico (audit producto 2026-05-18): logros tira
              al mismo dorado del ranking pero con tono más ámbar oscuro
              para evocar "salón de trofeos" / coleccionismo. Mantenemos
              el kanji 勲章 (medalla) — tiene intención semántica directa
              con el tema de la página. */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-amber-300">
            <Trophy className="h-3 w-3" />
            勲章 · Logros
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Catálogo de logros
          </h1>
          <p className="max-w-2xl text-fg-muted">
            {total} insignias que coleccionar votando, prediciendo brackets y
            completando torneos. Cada una tiene su rareza y un kanji
            asociado.
            {user && (
              <>
                {' '}Llevas{' '}
                <strong className="font-semibold text-fg-strong tabular-nums">
                  {desbloqueados} / {total}
                </strong>
                .
              </>
            )}
          </p>
          {!user && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                to="/registro"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
              >
                Crear cuenta
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/votar"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent/40"
              >
                Empezar votando
              </Link>
            </div>
          )}
        </motion.header>

        <div className="mb-6 flex flex-wrap gap-1.5">
          {FILTROS_RAREZA.map((f) => {
            const n =
              f.value == null
                ? total
                : (catalogo ?? []).filter((l) => l.rareza === f.value).length
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

        {cargandoCatalogo ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : visibles.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-6 text-center text-fg-muted">
            No hay logros con esta rareza.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.map((l) => (
              <BadgeCardCatalogo
                key={l.codigo}
                logro={l}
                count={stats?.[l.codigo] ?? 0}
                destacado={l.codigo === logroDestacado}
              />
            ))}
          </div>
        )}

        {user && (
          <div className="mt-10 rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-fg-strong">
              <Users className="h-4 w-4 text-accent" />
              Tu progreso público
            </h2>
            <p className="mb-4 text-[13px] text-fg-muted">
              Tu colección de logros se puede compartir desde tu perfil
              público. Cualquiera puede ver lo que has desbloqueado.
            </p>
            <Link
              to={`/u/${user.username}/logros`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent/40"
            >
              Ver mi perfil de logros
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
    </VisualPageShell>
  )
}

export default LogrosPage
