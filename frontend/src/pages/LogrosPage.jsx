import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Trophy, Users, ArrowRight, Sparkles, Award } from 'lucide-react'
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
import TrophyHall from '../features/logros/TrophyHall'
import {
  esPrimeraVisitaLogros,
  leerLogrosVistos,
  marcarLogrosVistos,
} from '../features/logros/logros-vistos'
import { iconoDeBadge } from '../lib/badgeIcons'
import { kanjiDeBadge } from '../lib/badgeKanji'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

// Estanterías del salón: la rareza ES la categoría (legendarios arriba).
// Kanji con significado: 伝 leyenda · 極 extremo · 稀 raro · 準 semi · 常 común.
// tier = laca de la medalla (tokens --color-medal-*).
const ESTANTERIAS_RAREZA = [
  { value: 5, kanji: '伝', name: 'Legendarios', tier: 'gold' },
  { value: 4, kanji: '極', name: 'Épicos', tier: 'gold' },
  { value: 3, kanji: '稀', name: 'Raros', tier: 'silver' },
  { value: 2, kanji: '準', name: 'Poco comunes', tier: 'bronze' },
  { value: 1, kanji: '常', name: 'Comunes', tier: 'bronze' },
]

/**
 * Catálogo público de logros.
 *
 * <p>Página pública que lista el catálogo de logros con descripción, rareza y
 * count comunidad ("X usuarios lo tienen"). Si el visitante está logueado,
 * los desbloqueados se marcan con check + glow accent.
 *
 * <p>Sirve dos propósitos:
 *   - SEO/GEO: añade una página indexable con datos extraíbles
 *     (Achievement schema) para crawlers.
 *   - Gamificación: el visitante anónimo ve qué se puede conseguir antes
 *     de registrarse; el logueado ve qué le falta.
 */
function LogrosPage() {
  const prefersReducedMotion = useReducedMotion()
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const { data: catalogo, isLoading: cargandoCatalogo } = useCatalogoLogros()
  const { data: mios, isLoading: cargandoMios } = useMisLogros({ enabled: Boolean(user) })
  const { data: stats } = useStatsLogros()

  // Cuando hay sesión usamos /mios (incluye desbloqueadoEn por logro).
  // Sin sesión, el catálogo plano basta — todos los badges en modo "cómo
  // conseguirlo".
  const fuente = user ? mios : catalogo

  // Registro local de medallas ya estampadas: lo desbloqueado que aún no
  // esté aquí entra con ceremonia de estampado en vivo (el backend no tiene
  // flag de no-visto — mismo patrón local que el snapshot de /mi-ranking).
  // Inicializador puro: una sola lectura por montaje.
  const [vistosIniciales] = useState(() => leerLogrosVistos())
  // Primera visita: NO estampamos la colección entera (serían decenas de
  // ceremonias); sembramos el registro abajo y la ceremonia solo dispara con
  // logros desbloqueados DESPUÉS de esta visita.
  const [primeraVisita] = useState(() => esPrimeraVisitaLogros())

  // Estanterías del salón por rareza, con kanji real de badgeKanji (fallback
  // al icono lucide del logro) y conteo de comunidad. Dentro de cada
  // estantería: desbloqueados primero, luego alfabético con collation del
  // idioma activo (los acentos y ñ rankean distinto en EN).
  const estanterias = useMemo(() => {
    if (!fuente) return []
    return ESTANTERIAS_RAREZA.map((nivel) => ({
      kanji: nivel.kanji,
      name: nivel.name,
      tier: nivel.tier,
      value: nivel.value, // id slug-safe de la estantería (aria-labelledby)
      items: fuente
        .filter((l) => l.rareza === nivel.value)
        .map((l) => ({
          codigo: l.codigo,
          kanji: kanjiDeBadge(l.codigo),
          Icon: iconoDeBadge(l.icono),
          nombre: l.nombre,
          descripcion: l.descripcion,
          // Sin sesión, modo escaparate: medallas a plena luz (catálogo).
          unlocked: user ? Boolean(l.desbloqueadoEn) : true,
          fecha: user ? (l.desbloqueadoEn ?? null) : null,
          // "nuevo" SOLO si no es la primera visita (entonces nada se estampa,
          // se siembra abajo) y aún no está en el registro local.
          nuevo: Boolean(
            user && l.desbloqueadoEn && !primeraVisita && !vistosIniciales.has(l.codigo),
          ),
          count: stats?.[l.codigo] ?? null,
        }))
        .sort((a, b) => {
          if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
          return a.nombre.localeCompare(b.nombre, i18n.language || undefined)
        }),
    })).filter((shelf) => shelf.items.length > 0)
  }, [fuente, i18n.language, stats, user, vistosIniciales, primeraVisita])

  // Con sesión el total sale de `mios` (catálogo + badges madrugador del usuario),
  // NO del catálogo estático: así desbloqueados y total cuentan AMBOS los madrugador
  // y la barra nunca pasa del 100% (antes total venía del catálogo SIN madrugador
  // mientras desbloqueados SÍ los contaba → >100%). El total es por-usuario a propósito.
  const total = (user ? mios?.length : catalogo?.length) ?? 16
  const desbloqueados = mios?.filter((l) => l.desbloqueadoEn).length ?? 0
  const logroDestacado = searchParams.get('logro')

  // Stats derivadas: legendarios desbloqueados, rareza media de coleccion.
  // Util como "tarjetas grandes" tipo cabecera para sentir el progreso
  // sin tener que leer todo el catálogo.
  const legendariosDesbloqueados = mios?.filter((l) => l.desbloqueadoEn && l.rareza === 5).length ?? 0
  const legendariosTotal = catalogo?.filter((l) => l.rareza === 5).length ?? 0
  const progresoPct = total > 0 ? Math.min(100, Math.round((desbloqueados / total) * 100)) : 0

  useEffect(() => {
    if (!logroDestacado || estanterias.length === 0) return undefined
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`logro-${logroDestacado}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [logroDestacado, estanterias.length])

  // Primera visita: sembrar el registro con TODO lo ya conseguido (sin
  // ceremonia) en cuanto `mios` esté listo, para que la próxima visita solo
  // estampe lo desbloqueado entre medias — no toda la colección histórica.
  useEffect(() => {
    if (!primeraVisita || !user || !Array.isArray(mios)) return
    const conseguidos = mios.filter((l) => l.desbloqueadoEn).map((l) => l.codigo)
    if (conseguidos.length > 0) marcarLogrosVistos(conseguidos)
  }, [primeraVisita, user, mios])

  useSeo({
    title: 'Logros desbloqueables',
    description: `Los ${total} logros que puedes desbloquear en AnimeShowdown — votos, predicciones, torneos y rachas diarias. Cada uno con su rareza y cuántos usuarios lo han conseguido.`,
  })

  return (
    <VisualPageShell visual={BRAND_VISUALS.logrosHero} contentClassName="mx-auto max-w-6xl" lateralKanji={null} atmosphere="tribute">
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
          variants={prefersReducedMotion ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.15 } } } : containerVariants}
        >
          {/* Acento oro místico (nota de producto 2026-05-18): logros tira
              al mismo dorado del ranking pero con tono más ámbar oscuro
              para evocar "salón de trofeos" / coleccionismo. Mantenemos
              el kanji 勲章 (medalla) — tiene intención semántica directa
              con el tema de la página. */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-[12px] font-semibold text-gold">
            <Trophy className="h-3 w-3" />
            勲章 · Logros
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
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
                to="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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

        {/* Stats tiles + progress bar (solo si user logueado).
            Diseño: 3 tarjetas grandes que cuentan la historia visual del
            progreso. La barra debajo da el % concreto. Antes solo habia
            "X / 14" en el parrafo — facil de pasar por alto. */}
        {user && (
          <motion.div
            className="mb-8 grid gap-3 sm:grid-cols-3"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0.15 } : { duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          >
            <StatTile
              icon={Trophy}
              valor={desbloqueados}
              total={total}
              label="Desbloqueados"
              accentClass="text-gold border-gold/30 bg-gold/5"
            />
            <StatTile
              icon={Sparkles}
              valor={legendariosDesbloqueados}
              total={legendariosTotal}
              label="Legendarios"
              accentClass="text-rarity-epic border-rarity-epic/30 bg-rarity-epic/5"
            />
            <StatTile
              icon={Award}
              valor={`${progresoPct}%`}
              label="Progreso total"
              accentClass="text-success border-success/30 bg-success/5"
            >
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg/60">
                {/* scaleX en vez de animar width: el llenado es idéntico
                    (el gradiente se comprime igual) sin re-layout por frame. */}
                <motion.div
                  className="h-full w-full rounded-full bg-gradient-to-r from-success via-gold to-rarity-epic"
                  style={{ transformOrigin: 'left' }}
                  initial={{ scaleX: prefersReducedMotion ? progresoPct / 100 : 0 }}
                  animate={{ scaleX: progresoPct / 100 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
            </StatTile>
          </motion.div>
        )}

        {cargandoCatalogo || (user && cargandoMios) ? (
          // Espera también a `mios` con sesión: si el salón monta antes de
          // tener los datos del usuario, el inicializador de la ceremonia se
          // siembra vacío y el estampado en vivo se salta (la medalla nueva
          // aparecería ya conseguida sin su silueta→sello).
          // Skeletons en grid: pre-llena 6 cards con shimmer animado.
          // Mejor que spinner solo porque "anuncia" la forma de lo que va
          // a aparecer — reduce layout shift y se siente mas premium.
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="relative h-40 overflow-hidden rounded-xl border border-border bg-gradient-to-r from-surface/40 via-surface/70 to-surface/40 bg-[length:200%_100%] animate-shimmer"
              >
                <div className="absolute inset-4 flex flex-col justify-between">
                  <div className="h-8 w-8 rounded-lg bg-bg/40" />
                  <div className="space-y-2">
                    <div className="h-3 w-2/3 rounded-lg bg-bg/40" />
                    <div className="h-2 w-1/2 rounded-lg bg-bg/30" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Salón de trofeos: estanterías por rareza (la rareza ES la
          // categoría — los filtros viejos quedaban redundantes) sobre el
          // hall dorado del banco de marca.
          <TrophyHall
            estanterias={estanterias}
            logueado={Boolean(user)}
            logroDestacado={logroDestacado}
            onEstampadosVistos={marcarLogrosVistos}
          />
        )}

        {user && (
          <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-fg-strong">
              <Users className="h-4 w-4 text-gold" />
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

/**
 * Tarjeta de stat de cabecera. Tres en fila: desbloqueados, legendarios,
 * progreso. accentClass controla el color (amber/fuchsia/emerald) para que
 * cada tile tenga su propio acento visual sin que el accent del tema se
 * mezcle. children sirve para meter la barra de progreso en la tercera.
 */
function StatTile({ icon: Icon, valor, total, label, accentClass, children }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-surface/40 p-4 backdrop-blur-sm ${accentClass}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg/30">
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black tabular-nums text-fg-strong">{valor}</span>
            {total != null && (
              <span className="text-sm text-fg-muted tabular-nums">/ {total}</span>
            )}
          </div>
          <p className="text-[11px] font-semibold opacity-80">{label}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default LogrosPage
