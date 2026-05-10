import { lazy, Suspense, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Quote, Star } from 'lucide-react'
import {
  personajes,
  imagenPersonaje,
  getIndicePersonaje,
  getStatsPersonaje,
} from '../data/personajes'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { buscarPersonajeJikan } from '../lib/jikan'
import { citaPersonaje } from '../lib/animechan'
import PersonajeCard from '../components/PersonajeCard'
import NotFoundPage from './NotFoundPage'

const Personaje3D = lazy(() => import('../components/Personaje3D'))

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function PersonajeDetailPage() {
  const { slug } = useParams()
  const idx = getIndicePersonaje(slug)
  const personaje = idx === -1 ? null : personajes[idx]

  // Hooks SIEMPRE arriba del posible early-return — Rules of Hooks: el orden no
  // puede variar entre renders. Antes el `if (idx === -1) return <NotFoundPage />`
  // estaba antes de useDocumentTitle/useState/useEffect, lo que hacía crashear
  // React con "Rendered fewer hooks than expected" al navegar de slug válido a
  // inválido (refresh tras delete, link roto, typo en URL).
  useDocumentTitle(personaje?.nombre ?? '404')
  const [jikan, setJikan] = useState(null)
  const [cita, setCita] = useState(null)

  useEffect(() => {
    if (!personaje) return
    let cancelado = false
    buscarPersonajeJikan(personaje.nombre, personaje.anime).then((d) => {
      if (!cancelado) setJikan(d)
    })
    citaPersonaje(personaje.nombre).then((q) => {
      if (!cancelado) setCita(q)
    })
    return () => {
      cancelado = true
    }
  }, [personaje])

  if (idx === -1) return <NotFoundPage />

  const stats = getStatsPersonaje(slug)
  const total = stats.wins + stats.losses
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0
  const prev = personajes[(idx - 1 + personajes.length) % personajes.length]
  const next = personajes[(idx + 1) % personajes.length]
  const relacionados = personajes
    .filter((p) => p.anime === personaje.anime && p.slug !== slug)
    .slice(0, 6)

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/personajes"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>
        <motion.div
          key={slug}
          className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center md:gap-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="relative aspect-[2/3] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface"
            style={{ filter: 'drop-shadow(0 30px 60px rgb(255 46 99 / 0.18))' }}
            variants={itemVariants}
          >
            <Suspense
              fallback={
                <img
                  src={imagenPersonaje(slug)}
                  alt={personaje.nombre}
                  className="h-full w-full object-cover"
                />
              }
            >
              <Personaje3D slug={slug} />
            </Suspense>
          </motion.div>
          <motion.div
            className="flex flex-col items-start gap-4"
            variants={containerVariants}
          >
            <motion.span
              className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted"
              variants={itemVariants}
            >
              Personaje {idx + 1} de {personajes.length}
              {jikan?.favorites != null && (
                <>
                  {' · '}
                  <Star className="ml-1 inline h-3 w-3 text-accent" />{' '}
                  {jikan.favorites.toLocaleString('es-ES')} fans
                </>
              )}
            </motion.span>
            <motion.h1
              className="text-[clamp(2rem,5vw,3.5rem)] leading-tight tracking-tight"
              variants={itemVariants}
            >
              {personaje.nombre}
            </motion.h1>
            <motion.p
              className="text-lg text-fg-muted"
              variants={itemVariants}
            >
              de{' '}
              <span className="font-semibold text-fg-strong">
                {personaje.anime}
              </span>
            </motion.p>
            <motion.div
              className="grid w-full grid-cols-3 gap-3"
              variants={itemVariants}
            >
              <Stat label="ELO" value={stats.elo} accent />
              <Stat
                label="Récord"
                value={`${stats.wins}-${stats.losses}`}
              />
              <Stat label="Win rate" value={`${winRate}%`} />
            </motion.div>
            {personaje.descripcion && (
              <motion.div
                className="rounded-lg border border-border bg-surface p-4"
                variants={itemVariants}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
                  Sobre el personaje
                </p>
                <p className="mt-2 text-sm leading-relaxed text-fg">
                  {personaje.descripcion}
                </p>
                {jikan?.nicknames?.length > 0 && (
                  <p className="mt-3 text-[12px] text-fg-muted">
                    También conocido como:{' '}
                    <span className="text-fg-strong">
                      {jikan.nicknames.slice(0, 4).join(', ')}
                    </span>
                  </p>
                )}
              </motion.div>
            )}
            {cita && (
              <motion.blockquote
                className="relative w-full rounded-lg border border-accent/30 bg-accent-soft p-4 pl-10"
                variants={itemVariants}
              >
                <Quote className="absolute left-3 top-3 h-5 w-5 text-accent" />
                <p className="text-sm italic leading-relaxed text-fg-strong">
                  {cita.content}
                </p>
                {(cita.character || cita.anime) && (
                  <cite className="mt-2 block text-[12px] not-italic text-fg-muted">
                    — {cita.character}
                    {cita.anime && (
                      <>
                        {' · '}
                        <span>{cita.anime}</span>
                      </>
                    )}
                  </cite>
                )}
              </motion.blockquote>
            )}
            <motion.p
              className="text-[12px] leading-relaxed text-fg-muted"
              variants={itemVariants}
            >
              Stats derivadas del historial de enfrentamientos. Cita y nicknames vía AnimeChan/MyAnimeList cuando están disponibles.
            </motion.p>
            <motion.div
              className="mt-2 flex w-full items-center justify-between gap-3 border-t border-border pt-4"
              variants={itemVariants}
            >
              <Link
                to={`/personajes/${prev.slug}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                {prev.nombre}
              </Link>
              <Link
                to={`/personajes/${next.slug}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-accent"
              >
                {next.nombre}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {relacionados.length > 0 && (
          <div className="mt-16">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
                  Mismo universo
                </span>
                <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
                  Más de {personaje.anime}
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
              {relacionados.map((p) => (
                <PersonajeCard key={p.slug} {...p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-xl font-bold ${
          accent ? 'text-accent' : 'text-fg-strong'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function recortar(texto, max) {
  if (!texto) return ''
  if (texto.length <= max) return texto
  return texto.slice(0, max).trim() + '…'
}

export default PersonajeDetailPage
