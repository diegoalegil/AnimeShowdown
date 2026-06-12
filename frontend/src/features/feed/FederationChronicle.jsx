import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Avatar from '../../components/Avatar'
import { useAuth } from '../../contexts/AuthContext'
import { useFeed } from '../../hooks/useFeed'
import { useStompSubscription } from '../../hooks/useStompSubscription'
import { endpoints } from '../../lib/api'
import { BRAND_VISUALS } from '../../data/visual-assets'
import { HankoSello } from './chronicle-hanko'
import {
  agrupaPorDia,
  clavesUnicas,
  esTintaFresca,
  fechaRelativa,
} from './chronicle'
import './chronicle.css'

/**
 * FederationChronicle — crónica del feed de comunidad (sustituye la lista
 * plana + spinner de FeedContenido en FeedPage).
 *
 * Línea de tiempo vertical con un hilo carmesí de 2px que se DIBUJA con el
 * scroll (CSS animation-timeline: scroll() — ver chronicle.css; fallback
 * IntersectionObserver por pasos). Cada evento cuelga del hilo con un sello
 * hanko por tipo (chronicle-hanko.jsx) que se estampa al entrar al viewport.
 *
 * Live: no hay canal STOMP del feed; el fan-out a seguidores llega por
 * /user/queue/notificaciones. El push solo toca el timbre — invalida la
 * query del feed y el REST sigue siendo la fuente de verdad. Los items
 * nuevos entran con pop de gota de tinta: AnimatePresence initial={false}
 * suprime la animación del primer render y anima solo las altas reales.
 *
 * Perf (reglas del proyecto):
 *  - El scroll es el motor: en la ruta feliz NO hay JS por frame.
 *  - Solo se anima transform/opacity (pop, sellos, hilo).
 *  - Sin blur/backdrop-blur ni SVG filters; scrim por gradiente.
 *  - prefers-reduced-motion: hilo completo, sellos estampados, sin pops.
 */

const EASE_GOTA = [0.2, 0.85, 0.3, 1.15]

// ── Hilo: ruta feliz scroll-driven, fallback IO por pasos discretos ──
function useHiloCronica(seccionRef, hiloRef, totalEventos) {
  const reduce = useReducedMotion()

  useEffect(() => {
    const hilo = hiloRef.current
    const seccion = seccionRef.current
    if (!hilo || !seccion || reduce) return undefined

    if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()')) {
      hilo.classList.add('chronicle-hilo--sda')
      return () => hilo.classList.remove('chronicle-hilo--sda')
    }

    // Fallback: el hilo crece hasta el último evento que ha entrado en
    // viewport. Pasos discretos + transición de transform = sin rAF.
    hilo.classList.add('chronicle-hilo--io')
    let max = 0.06
    const io = new IntersectionObserver(
      (entries) => {
        let cambio = false
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const el = e.target
          const f = (el.offsetTop + el.offsetHeight * 0.6) / seccion.offsetHeight
          if (f > max) {
            max = Math.min(1, f)
            cambio = true
          }
          io.unobserve(el)
        }
        if (cambio) hilo.style.transform = `scaleY(${max})`
      },
      { threshold: 0.35, rootMargin: '0px 0px -6% 0px' },
    )
    seccion.querySelectorAll('[data-cronica-evento]').forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
      hilo.classList.remove('chronicle-hilo--io')
    }
  }, [seccionRef, hiloRef, reduce, totalEventos])
}

function textoPorTipo(item) {
  const p = item.payload || {}
  switch (item.tipo) {
    case 'VOTO':
      return p.empate ? (
        <>
          no decidió entre{' '}
          <span className="font-semibold text-gold">{p.personajeNombre || 'un personaje'}</span>
          {p.oponenteNombre && <span className="text-fg-muted"> y {p.oponenteNombre}</span>}
        </>
      ) : (
        <>
          votó a{' '}
          {p.personajeSlug ? (
            <Link to={`/personajes/${p.personajeSlug}`} className="font-semibold text-gold hover:underline">
              {p.personajeNombre}
            </Link>
          ) : (
            <span className="font-semibold text-gold">{p.personajeNombre || 'un personaje'}</span>
          )}
          {p.oponenteNombre && <span className="text-fg-muted"> contra {p.oponenteNombre}</span>}
        </>
      )
    case 'LOGRO':
      return (
        <>
          desbloqueó{' '}
          <Link to="/logros" className="font-semibold text-gold hover:underline">
            {p.nombre || 'un logro'}
          </Link>
        </>
      )
    case 'TORNEO_CREADO':
      return (
        <>
          creó el torneo{' '}
          {p.torneoSlug ? (
            <Link to={`/torneos/${p.torneoSlug}`} className="font-semibold text-gold hover:underline">
              {p.torneoNombre}
            </Link>
          ) : (
            <span className="font-semibold text-gold">{p.torneoNombre || 'sin nombre'}</span>
          )}
        </>
      )
    case 'SEGUIMIENTO':
      return (
        <>
          empezó a seguir a{' '}
          {p.seguidoUsername ? (
            <Link to={`/u/${p.seguidoUsername}`} className="font-semibold text-gold hover:underline">
              {p.seguidoUsername}
            </Link>
          ) : (
            <span className="font-semibold text-gold">otro fan</span>
          )}
        </>
      )
    default:
      return null
  }
}

/**
 * Un evento colgado del hilo. `popInVivo` solo en el bloque de hoy (dentro
 * de AnimatePresence): las altas del push entran con gota de tinta; los
 * bloques de ayer/antes nunca animan su mount.
 */
function CronicaEvento({ item, indice, popInVivo = false }) {
  const reduce = useReducedMotion()
  const contenido = textoPorTipo(item)
  if (!contenido) return null
  const p = item.payload || {}
  const autor = p.autorUsername
  const fresca = esTintaFresca(item.fecha)

  return (
    <motion.li
      data-cronica-evento
      layout={popInVivo && !reduce}
      initial={popInVivo && !reduce ? { opacity: 0, scale: 0.55, y: -18 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_GOTA }}
      className="grid grid-cols-[44px_1fr] items-start gap-2.5"
    >
      <HankoSello tipo={item.tipo} indice={indice} estampaInmediata={fresca} />
      <div className="min-w-0 rounded-xl border border-border/45 bg-bg p-3 transition-colors hover:border-accent/50">
        <div className="flex items-start gap-2 text-[13.5px] leading-snug">
          {autor && (
            <Link to={`/u/${autor}`} className="shrink-0">
              <Avatar user={{ username: autor, avatarUrl: p.autorAvatarUrl }} size={22} />
            </Link>
          )}
          <span className="min-w-0">
            {autor && (
              <Link to={`/u/${autor}`} className="font-semibold text-fg-strong hover:underline">
                {autor}
              </Link>
            )}{' '}
            <span className="text-fg">{contenido}</span>
          </span>
        </div>
        <p className={`mt-1.5 pl-[30px] font-mono text-[11px] ${fresca ? 'text-electric' : 'text-fg-muted'}`}>
          {fresca && <span className="mr-1.5 inline-block h-1 w-1 rounded-full bg-electric align-middle" />}
          {fechaRelativa(item.fecha)}
        </p>
      </div>
    </motion.li>
  )
}

function SeparadorDia({ etiqueta }) {
  return (
    <li className="grid grid-cols-[44px_1fr] items-center gap-2.5">
      <span className="flex w-[44px]">
        <span className="ml-[17px] h-2 w-2 rotate-45 border border-gold bg-bg" aria-hidden="true" />
      </span>
      <span className="font-mono text-[11px] text-gold">{etiqueta}</span>
    </li>
  )
}

export default function FederationChronicle() {
  const { data, isLoading, isError } = useFeed({ size: 30 })
  const queryClient = useQueryClient()
  const seccionRef = useRef(null)
  const hiloRef = useRef(null)

  // El timbre del directo: cualquier push del fan-out a seguidores
  // refresca la crónica (REST = fuente de verdad, sin mapear payloads).
  const { lastMessage } = useStompSubscription('/user/queue/notificaciones')
  useEffect(() => {
    if (!lastMessage) return
    queryClient.invalidateQueries({ queryKey: ['feed'] })
  }, [lastMessage, queryClient])

  const entradas = useMemo(() => clavesUnicas(data?.items ?? []), [data])
  useHiloCronica(seccionRef, hiloRef, entradas.length)

  if (isLoading) return <CronicaCargando />
  if (isError) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-[13px] text-fg-muted">
        No pudimos cargar la crónica ahora mismo. Inténtalo de nuevo en un momento.
      </p>
    )
  }
  if (!data?.sigueAAlguien) return <EmptyCronicaSinSeguidos />

  const { hoy, ayer, antes } = agrupaPorDia(entradas)
  const total = hoy.length + ayer.length + antes.length
  if (total === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-[13px] text-fg-muted">
        Aún no hay actividad reciente de quienes sigues. En cuanto voten, desbloqueen
        un logro o creen un torneo, su tinta correrá por este hilo.
      </p>
    )
  }

  let indice = 0
  const bloque = (lista, popInVivo = false) =>
    lista.map(({ item, key }) => (
      <CronicaEvento key={key} item={item} indice={indice++} popInVivo={popInVivo} />
    ))

  return (
    <section ref={seccionRef} className="relative" aria-label="Crónica de actividad">
      {/* Gota de origen del hilo */}
      <span
        aria-hidden="true"
        className="absolute -top-1 left-[16.5px] h-[11px] w-[11px] rotate-45 rounded-[50%_50%_50%_4px] bg-accent shadow-aura-sm"
      />
      {/* Hilo carmesí de 2px — se dibuja con el scroll (chronicle.css) */}
      <div
        ref={hiloRef}
        aria-hidden="true"
        className="chronicle-hilo absolute bottom-8 left-[21px] top-1 w-0.5 rounded-full"
      />
      <ul className="flex flex-col gap-3.5">
        {hoy.length > 0 && (
          <SeparadorDia
            etiqueta={`Hoy — ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`}
          />
        )}
        <AnimatePresence initial={false}>{bloque(hoy, true)}</AnimatePresence>
        {ayer.length > 0 && <SeparadorDia etiqueta="Ayer" />}
        {bloque(ayer)}
        {antes.length > 0 && <SeparadorDia etiqueta="Días anteriores" />}
        {bloque(antes)}
        <li className="grid grid-cols-[44px_1fr] items-center gap-2.5 pt-2">
          <span className="flex w-[44px]">
            <span
              className="ml-1.5 flex h-[30px] w-[30px] items-center justify-center rounded-full border border-gold/45 bg-bg text-[13px] text-gold/85"
              style={{ fontFamily: 'var(--font-kanji-serif)' }}
              aria-hidden="true"
            >
              終
            </span>
          </span>
          <span className="font-mono text-[11px] text-fg-muted">
            fin de la crónica — sigue a más fans para alargar el hilo
          </span>
        </li>
      </ul>
    </section>
  )
}

/** Skeleton sobrio: el arranque del hilo + tres huecos de evento (nada de
 *  spinner genérico). Solo opacity en el pulso. */
function CronicaCargando() {
  return (
    <div className="relative animate-pulse" aria-hidden="true">
      <span className="absolute left-[21px] top-1 h-40 w-0.5 rounded-full bg-accent/40" />
      <div className="flex flex-col gap-3.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-[44px_1fr] items-start gap-2.5">
            <span className="ml-[3px] h-9 w-9 rounded-full border border-border/60 bg-surface" />
            <div className="h-16 rounded-xl border border-border/45 bg-surface" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Empty sin seguidos: escena con arte del banco + «Sigue a tus luchadores»
 * con 3 perfiles reales sugeridos por actividad (top voters públicos, sin
 * el propio usuario). El follow resuelve el id vía perfil público — los
 * endpoints de seguimiento van por usuarioId y el leaderboard solo trae
 * username — y refresca la crónica al confirmar.
 */
export function EmptyCronicaSinSeguidos() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [seguidos, setSeguidos] = useState(() => new Set())

  const { data: voters } = useQuery({
    queryKey: ['feed', 'sugerencias'],
    queryFn: () => endpoints.topVoters({ periodo: 'all', limit: 6 }),
    staleTime: 60_000,
  })
  const sugerencias = (voters ?? [])
    .filter((v) => v.username && v.username !== user?.username)
    .slice(0, 3)

  const seguir = useMutation({
    mutationFn: async (username) => {
      const perfil = await endpoints.perfilPublico(username)
      if (!perfil?.siguiendo) await endpoints.seguir(perfil.id)
      return username
    },
    onSuccess: (username) => {
      setSeguidos((prev) => new Set(prev).add(username))
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  const visual = BRAND_VISUALS.empty
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-surface">
        {visual?.image && (
          <img
            src={visual.image}
            srcSet={visual.imageWebpSrcset ?? undefined}
            sizes="(max-width: 768px) 100vw, 680px"
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-50"
          />
        )}
        {/* Scrim de legibilidad solo donde hay texto encima */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/10 via-bg/90 to-bg" />
        <span
          aria-hidden="true"
          className="absolute right-5 top-3 text-[92px] font-black leading-none text-gold/15"
          style={{ fontFamily: 'var(--font-kanji-serif)' }}
        >
          縁
        </span>
        <div className="relative px-6 pb-6 pt-44 sm:pt-48">
          <h2 className="mb-2 text-xl font-bold text-fg-strong sm:text-2xl">
            Tu crónica está en blanco
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-fg-muted">
            En cuanto sigas a otros fans, su tinta empezará a correr por este hilo:
            votos, logros, torneos y nuevos lazos, estampados en directo.
          </p>
        </div>
      </div>

      {sugerencias.length > 0 && (
        <div className="rounded-2xl border border-border/45 bg-bg p-4 sm:p-5">
          <h3 className="text-[15px] font-semibold text-fg-strong">Sigue a tus luchadores</h3>
          <p className="mb-3.5 font-mono text-[11px] text-fg-muted">
            los fans más activos de la federación
          </p>
          <ul className="flex flex-col gap-2.5">
            {sugerencias.map((su) => {
              const yaSeguido = seguidos.has(su.username)
              const pendiente = seguir.isPending && seguir.variables === su.username
              return (
                <li
                  key={su.username}
                  className="flex items-center gap-3 rounded-xl border border-border/35 p-3 transition-colors hover:border-gold/35"
                >
                  <Avatar user={{ username: su.username, avatarUrl: su.avatarUrl }} size={44} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Link
                      to={`/u/${su.username}`}
                      className="truncate text-sm font-semibold text-fg-strong hover:underline"
                    >
                      {su.username}
                    </Link>
                    <span className="font-mono text-[10.5px] text-fg-muted">
                      {Number(su.votos).toLocaleString('es-ES')} votos emitidos
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={yaSeguido || pendiente}
                    onClick={() => seguir.mutate(su.username)}
                    className={`min-h-9 shrink-0 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                      yaSeguido
                        ? 'border border-gold/40 bg-gold-soft text-gold'
                        : 'bg-accent text-white hover:bg-accent-hover disabled:opacity-60'
                    }`}
                  >
                    {yaSeguido ? 'Siguiendo' : pendiente ? 'Siguiendo…' : 'Seguir'}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
