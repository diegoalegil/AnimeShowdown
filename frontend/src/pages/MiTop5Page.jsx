import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Image as ImageIcon } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { getPersonajeBySlug } from '../lib/personajes-core'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import {
  getLocalVoteStats,
  listenLocalVotes,
  readLocalVotes,
} from '../lib/localVoteRanking'
import CanvasPreview from '../features/miTop5/CanvasPreview'
import { miTop5Schema } from '../features/miTop5/mi-top5-schema'
import RankingImportPanel from '../features/miTop5/RankingImportPanel'
import Top5QuickSuggestions from '../features/miTop5/Top5QuickSuggestions'
import Top5SearchPanel from '../features/miTop5/Top5SearchPanel'
import Top5Slot from '../features/miTop5/Top5Slot'
import {
  buildInitialSlots,
  getTop5AddSlugs,
  SLOTS,
  STORAGE_KEY,
  SUGERENCIAS_RAPIDAS_SLUGS,
} from '../features/miTop5/top5-storage'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

/**
 * Generador "Mi Top 5" — el usuario elige 5 personajes
 * favoritos del catálogo y exporta una imagen 1200×630 lista para
 * Twitter/Discord/Instagram con su selección.
 *
 * <p>Renderiza un canvas server-side-style en cliente con:
 * - Fondo dark con aurora magenta blur (consistente con el sitio).
 * - Logo AnimeShowdown arriba izq.
 * - Título "Mi Top 5 anime".
 * - Grid horizontal de las 5 cards con avatar + nombre + anime.
 * - Watermark animeshowdown.dev abajo derecha.
 *
 * <p>Sin backend, sin OG image dinámica — todo client-side con canvas.
 * Las imágenes del catálogo se descargan con crossOrigin para que canvas
 * permita exportar sin "tainted canvas" error. Si alguna falla (imagen
 * privada no permitida), usamos placeholder color.
 *
 * <p>Persistencia: el set elegido queda en localStorage para que el user
 * pueda volver a la página y seguir editando sin perder lo que hizo.
 */
function MiTop5Page() {
  useSeo({
    title: 'Mi Top 5 anime — Generador compartible',
    description:
      'Elige tus 5 personajes anime favoritos o rellénalos desde tu ranking personal y exporta una imagen 1200×630 para compartir.',
    canonical: 'https://animeshowdown.dev/mi-top5',
  })
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const [searchParams, setSearchParams] = useSearchParams()
  const addFromQuery = useMemo(
    () => getTop5AddSlugs(searchParams),
    [searchParams],
  )
  const [localVotes, setLocalVotes] = useState(() => readLocalVotes())
  const personajesBySlug = useMemo(
    () => new Map(catalogoPersonajes.map((p) => [p.slug, p])),
    [catalogoPersonajes],
  )

  const [slots, setSlots] = useState(() =>
    buildInitialSlots(addFromQuery),
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slots))
    } catch {
      // ignore
    }
  }, [slots])

  useEffect(
    () => listenLocalVotes((nextVotes) => setLocalVotes(nextVotes)),
    [],
  )

  useEffect(() => {
    if (addFromQuery.length === 0) return
    const validos = addFromQuery
      .filter((slug) => getPersonajeBySlug(slug) && slots.includes(slug))
      .map((slug) => getPersonajeBySlug(slug)?.nombre)
      .filter(Boolean)
    if (validos.length > 1) {
      toast.success(`${validos.length} personajes listos en tu Top 5`)
    } else if (validos.length === 1) {
      toast.success(`${validos[0]} listo en tu Top 5`)
    } else {
      toast.error('No pude añadir esos personajes al Top 5')
    }
    setSearchParams({}, { replace: true })
  }, [addFromQuery, setSearchParams, slots])

  const personalStats = useMemo(
    () => getLocalVoteStats(localVotes),
    [localVotes],
  )
  const personalTopSlugs = useMemo(
    () =>
      personalStats.top
        .map((item) => item.slug)
        .filter((slug) => personajesBySlug.has(slug))
        .slice(0, SLOTS),
    [personalStats.top, personajesBySlug],
  )
  const personalTopPreview = personalTopSlugs
    .map((slug) => personajesBySlug.get(slug)?.nombre)
    .filter(Boolean)
    .slice(0, 3)

  const setSlot = (idx, slug) => {
    setSlots((s) => {
      const next = [...s]
      next[idx] = slug
      return next
    })
  }

  const quitarSlot = (idx) => setSlot(idx, null)

  const completo = slots.every(Boolean)
  const slotsVacios = slots.filter((s) => !s).length

  // Sugerencias = top slugs que aún no están en el top del user
  const sugerenciasDisponibles = useMemo(() => {
    return SUGERENCIAS_RAPIDAS_SLUGS
      .map((slug) => personajesBySlug.get(slug))
      .filter((p) => p && !slots.includes(p.slug))
      .slice(0, 6)
  }, [personajesBySlug, slots])

  const addSlugAlPrimerSlotLibre = (slug) => {
    const idx = slots.findIndex((s) => !s)
    if (idx === -1) {
      toast.info('Top 5 completo. Quita uno para añadir otro.')
      return
    }
    if (slots.includes(slug)) {
      toast.info('Ese personaje ya está en tu top.')
      return
    }
    setSlot(idx, slug)
  }

  const rellenarDesdeRanking = () => {
    if (personalTopSlugs.length === 0) {
      toast.info('Vota algunos duelos para crear un ranking personal primero.')
      return
    }
    const next = []
    for (const slug of personalTopSlugs) {
      if (!next.includes(slug)) next.push(slug)
    }
    for (const slug of slots) {
      if (slug && !next.includes(slug)) next.push(slug)
    }
    setSlots(next.slice(0, SLOTS).concat(Array(SLOTS).fill(null)).slice(0, SLOTS))
    toast.success(
      personalTopSlugs.length >= SLOTS
        ? 'Top 5 rellenado con tu ranking personal'
        : `Añadidos ${personalTopSlugs.length} de tu ranking personal`,
    )
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Mi Top 5', path: '/mi-top5' },
        ])}
      />
      <JsonLd id="mi-top5-page" schema={miTop5Schema()} />
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-gold">
            <ImageIcon className="h-3 w-3" />
            Mi Top 5
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Tu top 5 anime, imagen lista para share
          </h1>
          <p className="text-[13px] text-fg-muted">
            Elige los 5 personajes que mejor te representan. Cuando esté listo,
            descarga la imagen 1200×630 y compártela en Twitter/Discord/
            Instagram con #AnimeShowdown.
          </p>
        </motion.header>

        <RankingImportPanel
          totalVotes={personalStats.total}
          topNames={personalTopPreview}
          canImport={personalTopSlugs.length > 0}
          onImport={rellenarDesdeRanking}
        />

        {/* Nota de producto: antes los slots usaban grid 1-col
            en mobile → cada uno aspect-2/3 full-width = ~580px de alto
            vacío. Cambio a grid-cols-5 en TODAS las viewports con tamaño
            compacto que se escala con sm:; los slots vacíos quedan
            pequeños y el resto de la página (buscador + sugerencias)
            entra dentro del primer viewport. */}
        <div className="mb-5 grid grid-cols-5 gap-2 sm:mb-8 sm:gap-4">
          {slots.map((slug, i) => (
            <Top5Slot
              key={i}
              slug={slug}
              personaje={slug ? personajesBySlug.get(slug) : null}
              index={i}
              onQuitar={() => quitarSlot(i)}
            />
          ))}
        </div>

        <Top5QuickSuggestions
          slotsVacios={slotsVacios}
          sugerencias={sugerenciasDisponibles}
          onAdd={addSlugAlPrimerSlotLibre}
        />

        <Top5SearchPanel
          onSelect={addSlugAlPrimerSlotLibre}
          filtroExtra={(p) => !slots.includes(p.slug)}
        />

        <CanvasPreview
          slots={slots}
          completo={completo}
          personajesBySlug={personajesBySlug}
        />
      </div>
    </section>
  )
}

export default MiTop5Page
