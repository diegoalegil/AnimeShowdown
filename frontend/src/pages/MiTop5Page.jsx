import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Image as ImageIcon } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
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
import AltarFive from '../features/miTop5/AltarFive'
import { brandImage } from '../lib/brand-assets'
import { slugifyAnime } from '../lib/animes'
import {
  buildInitialSlots,
  getTop5AddSlugs,
  mergeTop5AddSlugs,
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
 * - Fondo «corte carmesí» de marca (tajo diagonal + hairline oro + 戦).
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
    noindex: true,
  })
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const [searchParams] = useSearchParams()
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
  const effectiveSlots = useMemo(
    () => mergeTop5AddSlugs(slots, addFromQuery),
    [slots, addFromQuery],
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(effectiveSlots))
    } catch {
      // ignore
    }
  }, [effectiveSlots])

  useEffect(
    () => listenLocalVotes((nextVotes) => setLocalVotes(nextVotes)),
    [],
  )

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
    setSlots(() => {
      const next = [...effectiveSlots]
      next[idx] = slug
      return next
    })
  }

  // Adapter del altar: el storage habla en slugs, el altar en entries
  // ricos. PersonajeImg resuelve la imagen y el color dominante por slug,
  // así que la entry solo necesita identidad y nombre visible.
  const altarEntries = useMemo(
    () =>
      effectiveSlots.map((slug) => {
        if (!slug) return null
        const p = personajesBySlug.get(slug)
        return { slug, name: p?.nombre ?? slug }
      }),
    [effectiveSlots, personajesBySlug],
  )

  // Arte de fondo del nº1: escena de marca del anime del primer puesto.
  const altarBgScene = useMemo(() => {
    const primero = effectiveSlots[0]
      ? personajesBySlug.get(effectiveSlots[0])
      : null
    if (!primero?.anime) return undefined
    return brandImage(`${slugifyAnime(primero.anime)}-scene-01`)?.src
  }, [effectiveSlots, personajesBySlug])

  const onAltarChange = (next) => {
    setSlots(next.map((e) => (e ? e.slug : null)))
  }

  const searchPanelRef = useRef(null)
  const enfocarBuscador = () => {
    const panel = searchPanelRef.current
    if (!panel) return
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' })
    panel.querySelector('input')?.focus({ preventScroll: true })
  }

  const completo = effectiveSlots.every(Boolean)
  const slotsVacios = effectiveSlots.filter((s) => !s).length

  // Sugerencias = top slugs que aún no están en el top del user
  const sugerenciasDisponibles = useMemo(() => {
    return SUGERENCIAS_RAPIDAS_SLUGS
      .map((slug) => personajesBySlug.get(slug))
      .filter((p) => p && !effectiveSlots.includes(p.slug))
      .slice(0, 6)
  }, [personajesBySlug, effectiveSlots])

  const addSlugAlPrimerSlotLibre = (slug) => {
    const idx = effectiveSlots.findIndex((s) => !s)
    if (idx === -1) {
      toast.info('Top 5 completo. Quita uno para añadir otro.')
      return
    }
    if (effectiveSlots.includes(slug)) {
      toast.info('Ese personaje ya está en tu top.')
      return
    }
    // El altar detecta la llegada (render-adjust por slug), la anima y la
    // anuncia por aria-live; el toast cierra el hilo acción→resultado que
    // antes daba el vuelo FLIP de la carta (retirado con el altar viejo).
    setSlot(idx, slug)
    toast.success(`Añadido como tu nº${idx + 1}`)
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
    for (const slug of effectiveSlots) {
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold text-gold">
            <ImageIcon className="h-3 w-3" />
            Mi Top 5
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
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

        {/* El altar de los cinco: peanas escalonadas (el nº1 más alto y
            centrado) con numerales kanji 一二三四五, velas votivas
            pausables y el arte del anime del nº1 de fondo. Reorden por
            drag (FLIP WAAPI) y ▲▼ 100% teclado; las llegadas descienden
            a su peana. Sustituye al Top5Altar 3D y a su vuelo FLIP. */}
        <AltarFive
          entries={altarEntries}
          onChange={onAltarChange}
          bgSceneSrc={altarBgScene}
          onBrowseCatalog={enfocarBuscador}
        />

        <Top5QuickSuggestions
          slotsVacios={slotsVacios}
          sugerencias={sugerenciasDisponibles}
          onAdd={addSlugAlPrimerSlotLibre}
        />

        <div ref={searchPanelRef}>
          <Top5SearchPanel
            onSelect={addSlugAlPrimerSlotLibre}
            filtroExtra={(p) => !effectiveSlots.includes(p.slug)}
          />
        </div>

        <CanvasPreview
          slots={effectiveSlots}
          completo={completo}
          personajesBySlug={personajesBySlug}
        />
      </div>
    </section>
  )
}

export default MiTop5Page
