import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Brain,
  Check,
  HelpCircle,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, gameWebApplicationSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import GameCatalogLoading from '../components/GameCatalogLoading'
import PanelResultadoAnime from '../components/PanelResultadoAnime'
import PersonajeImg from '../components/PersonajeImg'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { getGameVisual } from '../data/visual-assets'
import { getCategoriasPersonaje } from '../data/personajes-tags'
import {
  buildGameShareText,
  crearBancoPreguntasOraculo,
  fechaDelDia,
  ORACULO_STORAGE_KEY,
  rankOraculoCandidates,
  safeStorage,
  seleccionarPreguntaOraculo,
} from '../lib/games'

const MAX_PREGUNTAS = 12
const SEO_IMAGE = getGameVisual('/games/oraculo').image

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function tagsDePersonaje(personaje) {
  return getCategoriasPersonaje(personaje.slug)
}

function OraculoPage() {
  useSeo({
    title: 'Oráculo Anime · Akinator por reglas',
    description:
      'Piensa en un personaje anime y responde preguntas de sí/no. El Oráculo usa reglas del catálogo para intentar adivinarlo.',
    canonical: 'https://animeshowdown.dev/games/oraculo',
    image: SEO_IMAGE,
  })

  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const preguntasDisponibles = useMemo(
    () => crearBancoPreguntasOraculo(catalogoPersonajes, tagsDePersonaje),
    [catalogoPersonajes],
  )

  if (preguntasDisponibles.length === 0) {
    return (
      <GameCatalogLoading
        kanji="心"
        title="Preparando Oráculo Anime"
        description="Cargando personajes y rasgos del catálogo para montar el motor de preguntas."
      />
    )
  }

  return <OraculoGame catalogoPersonajes={catalogoPersonajes} />
}

function OraculoGame({ catalogoPersonajes }) {
  const [respuestas, setRespuestas] = useState(() => loadEstado().respuestas)
  const [revelado, setRevelado] = useState(() => loadEstado().finalizado)

  const pregunta = useMemo(
    () => seleccionarPreguntaOraculo(catalogoPersonajes, respuestas, tagsDePersonaje),
    [catalogoPersonajes, respuestas],
  )
  const ranking = useMemo(
    () => rankOraculoCandidates(catalogoPersonajes, respuestas, tagsDePersonaje).slice(0, 5),
    [catalogoPersonajes, respuestas],
  )
  const top = ranking[0]
  const totalRespondidas = Object.keys(respuestas).length
  const respuestasUtiles = Object.values(respuestas).filter((r) => r !== 'nose').length
  const debeResolver =
    !pregunta ||
    totalRespondidas >= MAX_PREGUNTAS ||
    (respuestasUtiles >= 5 && top?.confianza >= 78)

  useEffect(() => {
    safeStorage.set(
      ORACULO_STORAGE_KEY,
      JSON.stringify({
        fecha: fechaDelDia(),
        respuestas,
        finalizado: revelado,
      }),
    )
  }, [respuestas, revelado])

  const responder = (respuesta) => {
    if (!pregunta || revelado) return
    setRespuestas((actual) => ({
      ...actual,
      [pregunta.id]: respuesta,
    }))
  }

  const revelar = () => {
    setRevelado(true)
    if (top) toast.success(`El Oráculo apuesta por ${top.nombre}`)
  }

  const reiniciar = () => {
    setRespuestas({})
    setRevelado(false)
  }

  const shareText = top
    ? buildGameShareText({
        game: 'Oráculo Anime',
        result: `${top.nombre} (${top.confianza}% confianza)`,
        detail: `${totalRespondidas} preguntas · ${top.anime}`,
        extra: 'AnimeShowdown',
      })
    : ''

  return (
    <section className="as-stage as-stage-purple as-stage-visual px-5 py-10 sm:px-8 sm:py-14">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
          { label: 'Oráculo Anime', path: '/games/oraculo' },
        ])}
      />
      <JsonLd
        id="game-oraculo"
        schema={gameWebApplicationSchema({
          name: 'Oráculo Anime',
          alternateName: 'Anime Akinator por reglas',
          path: '/games/oraculo',
          description:
            'Juego de preguntas sí/no que intenta adivinar un personaje anime usando reglas del catálogo local.',
          featureList: [
            'Motor determinista sin servicios externos',
            'Preguntas por anime, arquetipo y ELO base',
            'Ranking de candidatos con confianza',
            'Resultado compartible',
          ],
          keywords: [
            'akinator anime',
            'oraculo anime',
            'adivina personaje anime',
            'anime quiz',
          ],
        })}
      />

      <div className="mx-auto max-w-6xl">
        <Link
          to="/games"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Hub de juegos
        </Link>

        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="as-kicker border-electric/45 bg-electric/10 text-electric">
            <Brain className="h-3 w-3" />
            <span lang="ja">心</span> · Oráculo Anime
          </span>
          <h1 className="text-[clamp(2.3rem,6vw,4.7rem)] font-extrabold leading-tight tracking-tight">
            Piensa en un personaje.
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-fg-muted">
            Responde con sinceridad y el motor intentará cerrar el círculo con
            reglas del catálogo. Cada respuesta estrecha el radar y muestra
            cuándo la apuesta aún tiene dudas.
          </p>
        </motion.header>

        {revelado && top && (
          <PanelResultadoAnime
            acertado={top.confianza >= 50}
            titulo={`Apuesto por ${top.nombre}`}
            tier={`${top.confianza}% de confianza · ${top.anime}`}
            squares={Object.values(respuestas).map((respuesta) => ({
              ok: respuesta === 'si',
              emoji: respuesta === 'nose' ? '?' : undefined,
            }))}
            shareText={shareText}
            shareTitle="Oráculo Anime — AnimeShowdown"
            shareUrl="/games/oraculo"
            kanji="心"
          >
            <button
              type="button"
              onClick={reiniciar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/55 px-4 py-2 text-[13px] font-semibold text-fg-strong transition-colors hover:border-accent/45 hover:text-gold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Nueva lectura
            </button>
          </PanelResultadoAnime>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="as-panel rounded-2xl border border-border p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-electric">
                  Lectura {Math.min(totalRespondidas + 1, MAX_PREGUNTAS)}/{MAX_PREGUNTAS}
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-fg-strong">
                  {revelado
                    ? 'Lectura cerrada'
                    : pregunta?.texto ?? 'No quedan preguntas fuertes'}
                </h2>
              </div>
              <button
                type="button"
                onClick={reiniciar}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/50 px-3 py-2 text-[12px] font-semibold text-fg-muted transition-colors hover:border-accent/45 hover:text-gold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reiniciar
              </button>
            </div>

            {!revelado && pregunta && (
              <div className="grid gap-3 sm:grid-cols-3">
                <AnswerButton
                  icon={Check}
                  label="Sí"
                  tone="success"
                  onClick={() => responder('si')}
                />
                <AnswerButton
                  icon={X}
                  label="No"
                  tone="danger"
                  onClick={() => responder('no')}
                />
                <AnswerButton
                  icon={HelpCircle}
                  label="No sé"
                  tone="muted"
                  onClick={() => responder('nose')}
                />
              </div>
            )}

            {!revelado && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={revelar}
                  disabled={!top || (!debeResolver && totalRespondidas < 3)}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Hacer apuesta
                </button>
                <p className="text-[12px] text-fg-muted" aria-live="polite">
                  {top
                    ? `Candidato actual: ${top.nombre} · ${top.confianza}%`
                    : 'Esperando candidatos.'}
                </p>
              </div>
            )}
          </div>

          <aside className="as-panel rounded-2xl border border-border p-5 sm:p-6">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
              Radar de candidatos
            </p>
            <div className="flex flex-col gap-3">
              {ranking.map((personaje, index) => (
                <CandidateCard
                  key={personaje.slug}
                  personaje={personaje}
                  index={index}
                  reveal={revelado || index === 0}
                />
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

function AnswerButton({ icon: Icon, label, tone, onClick }) {
  const toneClass = {
    success: 'border-success/40 bg-success/10 text-success hover:bg-success/20',
    danger: 'border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
    muted: 'border-border bg-bg/55 text-fg-muted hover:border-accent/45 hover:text-gold',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-24 items-center justify-center gap-2 rounded-xl border px-4 py-4 text-base font-black transition-colors ${toneClass}`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  )
}

function CandidateCard({ personaje, index, reveal }) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-border bg-bg/45 p-3">
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-surface">
        <PersonajeImg
          slug={personaje.slug}
          alt={reveal ? personaje.nombre : 'Candidato oculto'}
          className={`h-full w-full object-cover ${reveal ? '' : 'blur-md saturate-50'}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-fg-strong">
          {reveal ? personaje.nombre : `Candidato ${index + 1}`}
        </p>
        <p className="truncate text-[12px] text-fg-muted">
          {reveal ? personaje.anime : 'Anime oculto'}
        </p>
      </div>
      <span className="rounded-lg border border-electric/35 bg-electric/10 px-2 py-1 font-mono text-[12px] font-bold text-electric">
        {personaje.confianza}%
      </span>
    </article>
  )
}

function loadEstado() {
  const fallback = { respuestas: {}, finalizado: false }
  const raw = safeStorage.get(ORACULO_STORAGE_KEY)
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    if (parsed.fecha !== fechaDelDia()) return fallback
    return {
      respuestas: parsed.respuestas && typeof parsed.respuestas === 'object'
        ? parsed.respuestas
        : {},
      finalizado: parsed.finalizado === true,
    }
  } catch {
    return fallback
  }
}

export default OraculoPage
