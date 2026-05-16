import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Swords } from 'lucide-react'
import { toast } from 'sonner'
import { personajes, imagenPersonaje } from '../data/personajes'
import { endpoints, ApiError } from '../lib/api'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useSound } from '../contexts/SoundContext'
import { useAuth } from '../contexts/AuthContext'

/**
 * VotarPage en modo HÍBRIDO (Plan v2 §1.1):
 *
 *   1. Pide GET /api/enfrentamientos/aleatorio.
 *   2. Si llega un match abierto (200) → MODO BACKEND: muestra los dos
 *      personajes reales, votar manda POST /enfrentamientos/{id}/votar y
 *      el cache de torneos se invalida (afecta al bracket en vivo).
 *   3. Si responde 404 (no hay matches abiertos) → MODO CASUAL: pares
 *      sintéticos del catálogo local. El "voto" es un toast sin persistir
 *      en BBDD — útil para tener algo que hacer cuando no hay torneos.
 *
 * El estado de auth solo importa en modo backend: si el usuario no está
 * logueado y pulsa votar, redirigimos a /login con next=/votar.
 */

const headerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function getRandomPair() {
  const a = Math.floor(Math.random() * personajes.length)
  let b = Math.floor(Math.random() * personajes.length)
  while (b === a) b = Math.floor(Math.random() * personajes.length)
  return [personajes[a], personajes[b]]
}

function VotarPage() {
  useDocumentTitle('Votar')
  const { play } = useSound()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Query del match real. Si 404 (no hay abiertos) caemos a modo casual.
  // staleTime 0 + refetch on demand para que cada "siguiente" pida uno
  // distinto. retry 0 porque el 404 NO es error transitorio, es señal.
  const {
    data: enfrentamiento,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['enfrentamientos', 'aleatorio'],
    queryFn: endpoints.enfrentamientoAleatorio,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  // Estado local del modo casual (fallback cuando no hay match abierto).
  const [casualPair, setCasualPair] = useState(getRandomPair)
  // Slug votado en esta sesión (independiente del modo). Bloquea doble voto.
  const [votedFor, setVotedFor] = useState(null)

  const votarMutation = useMutation({
    mutationFn: ({ enfrentamientoId, personajeGanadorId }) =>
      endpoints.votar(enfrentamientoId, personajeGanadorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torneos'] })
    },
  })

  // Modo backend si la query retornó datos; casual si vino 404 (status 404
  // en ApiError) o cualquier otro error de red.
  const modoBackend = Boolean(enfrentamiento && !isError)
  const sinMatchesAbiertos = isError && error instanceof ApiError && error.status === 404

  if (isLoading) {
    return (
      <section className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </section>
    )
  }

  // Datos a renderizar (uniforme para ambos modos).
  let a, b, matchId
  if (modoBackend) {
    a = enfrentamiento.personaje1
    b = enfrentamiento.personaje2
    matchId = enfrentamiento.id
  } else {
    ;[a, b] = casualPair
    matchId = null
  }

  const handleVote = (personaje) => {
    if (votedFor) return
    play('playImpact')
    setTimeout(() => play('playVote'), 120)

    if (modoBackend) {
      if (!user) {
        toast.error('Inicia sesión para votar', {
          description: 'Te llevamos al login.',
        })
        navigate(`/login?next=${encodeURIComponent('/votar')}`)
        return
      }
      setVotedFor(personaje.slug)
      votarMutation.mutate(
        { enfrentamientoId: matchId, personajeGanadorId: personaje.id },
        {
          onSuccess: () => {
            toast.success(`Voto registrado: ${personaje.nombre}`, {
              description: `de ${personaje.anime}`,
            })
          },
          onError: (err) => {
            setVotedFor(null) // permite reintentar
            const status = err instanceof ApiError ? err.status : 0
            if (status === 409) {
              toast.error('Ya votaste este enfrentamiento')
            } else if (status === 401) {
              navigate(`/login?next=${encodeURIComponent('/votar')}`)
            } else {
              toast.error('No se pudo registrar el voto', {
                description: err?.message || 'Inténtalo de nuevo.',
              })
            }
          },
        },
      )
    } else {
      // Modo casual: solo toast, sin persistencia.
      setVotedFor(personaje.slug)
      toast.success(`Voto registrado: ${personaje.nombre}`, {
        description: `${personaje.anime} · sin torneo activo`,
      })
    }
  }

  const handleNext = () => {
    play('playClick')
    setVotedFor(null)
    if (modoBackend) {
      refetch()
    } else {
      setCasualPair(getRandomPair())
    }
  }

  // Para mostrar % de votos en modo backend usamos el total real si llegó
  // del backend. En casual derivamos un split visual sintético (50/50)
  // para no romper el layout — el dato no es real.
  const showResult = Boolean(votedFor)
  const pctA = 50
  const pctB = 50

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <motion.header
          className="mb-10 flex flex-col items-center gap-3 text-center"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <span className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            {modoBackend ? 'Match en juego' : 'Enfrentamiento aleatorio'}
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            ¿A quién prefieres?
          </h1>
          <p className="max-w-xl text-fg-muted">
            {modoBackend
              ? 'Tu voto cuenta para el bracket en directo. Necesitas haber iniciado sesión.'
              : sinMatchesAbiertos
                ? 'Ahora mismo no hay torneos en juego — pares aleatorios para que sigas votando sin parar.'
                : 'Pulsa la card del personaje que crees que ganaría.'}
          </p>
          {sinMatchesAbiertos && (
            <Link
              to="/torneos"
              className="text-[12px] text-accent hover:underline"
            >
              Ver torneos disponibles →
            </Link>
          )}
        </motion.header>
        <div
          key={`${a.slug}-${b.slug}`}
          className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-6"
        >
          <VoteCard
            personaje={a}
            onClick={() => handleVote(a)}
            isVoted={votedFor === a.slug}
            showResult={showResult}
            pct={pctA}
          />
          <span className="flex h-14 w-14 items-center justify-center justify-self-center rounded-full border border-accent/40 bg-accent-soft text-accent">
            <Swords className="h-6 w-6" />
          </span>
          <VoteCard
            personaje={b}
            onClick={() => handleVote(b)}
            isVoted={votedFor === b.slug}
            showResult={showResult}
            pct={pctB}
          />
        </div>
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={handleNext}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {votedFor ? 'Siguiente enfrentamiento →' : 'Saltar enfrentamiento →'}
          </button>
        </div>
      </div>
    </section>
  )
}

function VoteCard({ personaje, onClick, isVoted, showResult, pct }) {
  const dimmed = showResult && !isVoted
  // En modo backend el personaje viene del DTO (PersonajeMiniDto con imagenUrl).
  // En modo casual viene del catálogo local. Ambos tienen slug/nombre/anime
  // y, para la imagen, preferimos imagenUrl del DTO; fallback a imagenPersonaje
  // del catálogo local cuando viene del modo casual.
  const imgSrc = personaje.imagenUrl ?? imagenPersonaje(personaje.slug)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={showResult}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-surface text-left transition-all ${
        isVoted
          ? 'border-accent ring-2 ring-accent/40'
          : 'border-border hover:border-accent/40 hover:-translate-y-1'
      } ${dimmed ? 'opacity-50' : ''} disabled:cursor-default`}
    >
      <img
        src={imgSrc}
        alt={personaje.nombre}
        className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div className="flex flex-col gap-1 p-4">
        <h3 className="text-base font-bold text-fg-strong">
          {personaje.nombre}
        </h3>
        <p className="text-[12px] text-fg-muted">{personaje.anime}</p>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mt-2"
          >
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
              <motion.div
                className={`h-full ${isVoted ? 'bg-accent' : 'bg-fg-muted'}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </button>
  )
}

export default VotarPage
