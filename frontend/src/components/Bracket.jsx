import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, Lock, Sparkles, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import {
  useAplicarPrediccion,
  useMisPredicciones,
} from '../hooks/usePredicciones'
import { ApiError } from '../lib/api'
import { useVotarEnfrentamiento } from '../lib/torneosQueries'
import PersonajeImg from './PersonajeImg'
import KanjiStroke from './KanjiStroke'

/**
 * Renderiza un bracket de eliminación directa con datos vivos del backend.
 *
 * 1 + §17.1 — antes el componente recibía `slugs` (array plano
 * de participantes) y computaba el ganador local por ELO, lo que producía
 * dos bugs:
 *   1. Los torneos 'proximo' mostraban estructura completa hasta la final
 *      como si las rondas hubieran ocurrido — el render no respetaba el
 *      estado real del torneo.
 *   2. Los ganadores eran inventados, no reflejaban los votos reales.
 *
 * Ahora el componente solo lee los DTOs que llegan del backend:
 *
 *   props.enfrentamientos: EnfrentamientoDto[] ya ordenados por
 *     (ronda asc, id asc). Cada uno con `personaje1`/`personaje2`
 *     posiblemente null (rondas futuras sin resolver) y `ganador`
 *     null hasta que la ronda se cierre.
 *   props.ganadorSlug: slug del campeón si el torneo está FINISHED.
 *   props.totalRondas: para etiquetar columnas (Octavos / Cuartos / etc.).
 *   props.estado: SCHEDULED / IN_PROGRESS / FINISHED (informativo —
 *     el render progresivo emerge naturalmente del shape de los datos).
 */

const TITULOS = {
  4: ['Octavos', 'Cuartos', 'Semifinal', 'Final'],
  3: ['Cuartos', 'Semifinal', 'Final'],
  2: ['Semifinal', 'Final'],
  1: ['Final'],
}

// Kanji decorativo por ronda. 一回戦 (primera ronda),
// 二回戦, 準決勝 (semifinal), 決勝 (final). El sufijo encaja según el
// número de rondas — la última siempre es 決勝.
const KANJI_RONDA = {
  4: ['一回戦', '二回戦', '準決勝', '決勝'],
  3: ['一回戦', '準決勝', '決勝'],
  2: ['準決勝', '決勝'],
  1: ['決勝'],
}

function Bracket({ enfrentamientos, ganadorSlug, totalRondas, torneoId, torneoSlug, estado }) {
  // Cargamos las predicciones del usuario para este torneo
  // (skip si no hay user o no hay torneoId). El hook ya respeta esos
  // gates internamente. Se indexa por enfrentamientoId para que cada
  // BracketMatch reciba solo su predicción.
  const { data: misPredicciones } = useMisPredicciones(torneoId)
  const prediccionesPorEnf = useMemo(() => {
    const map = new Map()
    for (const p of misPredicciones ?? []) {
      map.set(p.enfrentamientoId, p)
    }
    return map
  }, [misPredicciones])

  if (!enfrentamientos || enfrentamientos.length === 0) {
    return null
  }

  // Agrupa los matches por ronda. enfrentamientos ya viene ordenado por
  // (ronda, id) del backend, así que la inserción mantiene el orden visual.
  const porRonda = new Map()
  for (const enf of enfrentamientos) {
    const r = enf.ronda
    if (!porRonda.has(r)) porRonda.set(r, [])
    porRonda.get(r).push(enf)
  }
  const rondas = [...porRonda.keys()].sort((a, b) => a - b)
  const titulos = TITULOS[totalRondas] || []
  const kanjis = KANJI_RONDA[totalRondas] || []

  // Barra de progreso del torneo. Cuenta matches resueltos
  // (con ganador) sobre el total. Útil de un vistazo para "X de Y matches".
  const totalMatches = enfrentamientos.length
  const matchesResueltos = enfrentamientos.filter((e) => e.ganador).length
  const rondaActual =
    rondas.find((r) =>
      porRonda.get(r).some((m) => m.personaje1 && m.personaje2 && !m.ganador),
    ) ?? rondas[rondas.length - 1]
  const rondaActualIdx = rondas.indexOf(rondaActual)

  // Campeón resuelto con dos fuentes (alineado con TorneoQueryService):
  //   - ganadorSlug del DTO (campo Torneo.ganadorPersonaje).
  //   - ganador del match de la última ronda en el array.
  const ultimoMatch = porRonda.get(rondas[rondas.length - 1])?.[0]
  const campeon =
    findPersonajePorSlug(enfrentamientos, ganadorSlug) ??
    ultimoMatch?.ganador ??
    null

  return (
    <div>
      {/* Barra de progreso superior con "X de Y matches"
          y ronda actual. Solo se muestra si hay matches resueltos o el
          torneo no es FINISHED (en ese caso, mostraría 100% redundante
          con la card de campeón). */}
      {totalMatches > 0 && matchesResueltos < totalMatches && (
        <div className="mb-5 rounded-lg border border-border bg-surface p-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px]">
            <span className="font-semibold uppercase tracking-[0.1em] text-fg-muted">
              Progreso
            </span>
            <span className="font-mono tabular-nums text-fg-muted">
              <strong className="text-fg-strong">{matchesResueltos}</strong> /{' '}
              {totalMatches} matches · ronda{' '}
              <strong className="text-fg-strong">
                {rondaActualIdx + 1} de {rondas.length}
              </strong>
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-bg">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent via-gold to-electric transition-all duration-700"
              style={{
                width: `${(matchesResueltos / totalMatches) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
      <div className="mb-2 flex justify-end sm:hidden">
        <span className="rounded-full border border-border bg-surface/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
          Desliza el bracket
        </span>
      </div>
      <div
        className="scrollbar-hide -mx-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8"
        aria-label="Bracket desplazable horizontalmente"
      >
        <div className="flex min-w-max snap-x snap-mandatory items-stretch gap-3 scroll-smooth">
          {rondas.map((ronda, i) => (
            <div
              key={ronda}
              className="flex min-w-[16rem] snap-start flex-col justify-around gap-3 sm:min-w-[180px]"
            >
              <div className="flex flex-col items-center gap-0.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
                  {titulos[i] || `Ronda ${ronda}`}
                </h3>
                {kanjis[i] && (
                  <span
                    aria-hidden="true"
                    lang="ja"
                    className="inline-flex items-center gap-0.5 text-gold/70"
                  >
                    <KanjiStroke
                      kanji={kanjis[i]}
                      size="0.95em"
                      strokeMs={380}
                      gapMs={70}
                      strokeWidth={6}
                    />
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {porRonda.get(ronda).map((match) => (
                  <BracketMatch
                    key={match.id}
                    match={match}
                    torneoId={torneoId}
                    torneoSlug={torneoSlug}
                    estado={estado}
                    prediccion={prediccionesPorEnf.get(match.id)}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex min-w-[16rem] snap-start flex-col items-stretch justify-around sm:min-w-[180px]">
            <div className="flex flex-col items-center gap-0.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold">
                Campeón
              </h3>
              <span
                aria-hidden="true"
                lang="ja"
                className="inline-flex items-center gap-0.5 text-gold/80"
              >
                <KanjiStroke
                  kanji="王者"
                  size="0.95em"
                  strokeMs={420}
                  gapMs={80}
                  strokeWidth={6}
                />
              </span>
            </div>
            {campeon ? (
              <ChampionSlot personaje={campeon} />
            ) : (
              <ChampionPlaceholder />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Busca un personaje (PersonajeMiniDto) por slug entre todos los matches
 * — fallback para el campeón cuando solo nos pasan ganadorSlug y no la
 * entidad completa.
 */
function findPersonajePorSlug(enfrentamientos, slug) {
  if (!slug) return null
  for (const e of enfrentamientos) {
    if (e.personaje1?.slug === slug) return e.personaje1
    if (e.personaje2?.slug === slug) return e.personaje2
    if (e.ganador?.slug === slug) return e.ganador
  }
  return null
}

function BracketMatch({ match, torneoId, torneoSlug, estado, prediccion }) {
  const ambosPersonajes = match.personaje1 && match.personaje2

  // Match vacío (slot de ronda futura sin resolver): placeholder difuminado.
  // Sigue el patrón ya existente del ChampionPlaceholder (border-dashed +
  // Lock + texto) para coherencia visual.
  if (!ambosPersonajes) {
    return (
      <div className="flex min-h-16 items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-alt/30 px-3 py-3 opacity-60">
        <Lock className="h-3 w-3 text-fg-muted" aria-hidden="true" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">
          Por decidir
        </span>
      </div>
    )
  }

  const ganadorId = match.ganador?.id
  const resuelto = Boolean(ganadorId)
  const abiertoParaVotar = estado === 'IN_PROGRESS' && !resuelto

  return (
    <div className="rounded-xl border border-border bg-surface p-2">
      <BracketSlot
        personaje={match.personaje1}
        winner={ganadorId === match.personaje1.id}
      />
      <div className="my-1 h-px bg-border" />
      <BracketSlot
        personaje={match.personaje2}
        winner={ganadorId === match.personaje2.id}
      />
      {abiertoParaVotar && (
        <VotoRow match={match} torneoSlug={torneoSlug} />
      )}
      {/* 4: picker de predicciones. Solo aparece si el match
          está abierto Y tenemos torneoId (i.e. user logueado, el hook
          padre cargó misPredicciones). Si resuelto, mostramos badge con
          el resultado de la predicción. */}
      {torneoId && (
        <PrediccionRow
          match={match}
          prediccion={prediccion}
          resuelto={resuelto}
          torneoId={torneoId}
        />
      )}
    </div>
  )
}

function VotoRow({ match, torneoSlug }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mutation = useVotarEnfrentamiento(torneoSlug)
  const [votadoLocal, setVotadoLocal] = useState(null)

  const totalVotos = match.totalVotos ?? 0
  const disabled = mutation.isPending || Boolean(votadoLocal)

  const onVote = (personaje) => {
    if (disabled) return
    if (!user) {
      toast.error('Entra para votar este duelo', {
        description: 'Te devolvemos al torneo después.',
      })
      const next = `${location.pathname}${location.search}${location.hash}`
      navigate(`/login?next=${encodeURIComponent(next)}`)
      return
    }

    setVotadoLocal('pending')
    mutation.mutate(
      { enfrentamientoId: match.id, personajeGanadorId: personaje.id },
      {
        onSuccess: (data) => {
          setVotadoLocal(personaje.id)
          toast.success(`Voto para ${personaje.nombre}`, {
            description: data?.votosGanador != null
              ? `${data.votosGanador} votos en este match`
              : 'Bracket actualizado',
          })
        },
        onError: (err) => {
          const status = err instanceof ApiError ? err.status : 0
          if (status === 409) {
            setVotadoLocal('ya-votado')
            toast.error('Ya votaste este enfrentamiento')
          } else if (status === 401 || status === 403) {
            setVotadoLocal(null)
            const next = `${location.pathname}${location.search}${location.hash}`
            navigate(`/login?next=${encodeURIComponent(next)}`)
          } else {
            setVotadoLocal(null)
            toast.error('No se pudo registrar el voto', {
              description: err?.message || 'Inténtalo de nuevo.',
            })
          }
        },
      },
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-accent/25 bg-accent/5 p-2">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        <span>Vota este duelo</span>
        <span className="font-mono tabular-nums">{totalVotos} votos</span>
      </div>
      <div className="flex gap-1">
        <VotoButton
          personaje={match.personaje1}
          active={votadoLocal === match.personaje1.id}
          disabled={disabled}
          onClick={() => onVote(match.personaje1)}
        />
        <VotoButton
          personaje={match.personaje2}
          active={votadoLocal === match.personaje2.id}
          disabled={disabled}
          onClick={() => onVote(match.personaje2)}
        />
      </div>
      {votadoLocal === 'pending' && (
        <p className="mt-1 text-center text-[10px] font-medium text-fg-muted">
          Registrando voto…
        </p>
      )}
      {votadoLocal && votadoLocal !== 'pending' && (
        <p className="mt-1 text-center text-[10px] font-medium text-gold">
          Voto registrado
        </p>
      )}
    </div>
  )
}

function VotoButton({ personaje, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Votar a ${personaje.nombre}`}
      className={`min-h-9 min-w-0 flex-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
        active
          ? 'border-accent bg-accent text-bg'
          : 'border-border bg-bg text-fg-strong hover:border-accent hover:bg-accent-soft hover:text-gold'
      }`}
    >
      <span className="block truncate">{personaje.nombre}</span>
    </button>
  )
}

/**
 * Footer del BracketMatch con la predicción.
 *
 * - Match abierto + sin predicción → botón "🔮 Predice".
 *   Click expande dos botones (los 2 personajes); click en uno → registra.
 * - Match abierto + con predicción → "Predijiste: <nombre>" + opción cambiar.
 * - Match resuelto + con predicción → badge verde/rojo según acertaste.
 * - Match resuelto + sin predicción → no se pinta nada.
 */
function PrediccionRow({ match, prediccion, resuelto, torneoId }) {
  const { user } = useAuth()
  const [picking, setPicking] = useState(false)
  const mutation = useAplicarPrediccion(torneoId)

  if (resuelto) {
    if (!prediccion) return null
    const acerto = prediccion.acertada === true
    return (
      <div
        className={`mt-1.5 flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold ${
          acerto
            ? 'bg-emerald-500/10 text-emerald-300'
            : 'bg-rose-500/10 text-rose-300'
        }`}
      >
        <Sparkles className="h-3 w-3" />
        {acerto ? '¡Acertaste tu predicción!' : 'Tu predicción falló'}
      </div>
    )
  }

  // No mostrar el picker a invitados — el botón redirigiría a login y
  // probablemente solo distrae en el grid del bracket.
  if (!user) return null

  const onPick = (personajeId) => {
    mutation.mutate(
      { enfrentamientoId: match.id, personajePredichoId: personajeId },
      {
        onSuccess: () => {
          setPicking(false)
          toast.success('Predicción guardada')
        },
        onError: (err) => {
          toast.error(
            err instanceof ApiError ? err.message : 'No se pudo guardar',
          )
        },
      },
    )
  }

  if (picking || !prediccion) {
    return (
      <div className="mt-1.5 flex items-center gap-1">
        {picking ? (
          <>
            <PickButton
              personaje={match.personaje1}
              onClick={() => onPick(match.personaje1.id)}
              disabled={mutation.isPending}
            />
            <PickButton
              personaje={match.personaje2}
              onClick={() => onPick(match.personaje2.id)}
              disabled={mutation.isPending}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="min-h-9 w-full rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] font-semibold text-fg-muted transition-colors hover:border-accent/40 hover:text-gold"
          >
            🔮 Predice el ganador
          </button>
        )}
      </div>
    )
  }

  // Predicción ya hecha (sin resolver). Mostrar resumen + opción cambiar.
  return (
    <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1">
      <Check className="h-3 w-3 shrink-0 text-gold" />
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-fg-strong">
        Predigo: {prediccion.personajePredichoNombre}
      </span>
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="text-[11px] text-fg-muted underline-offset-2 hover:text-gold hover:underline"
      >
        cambiar
      </button>
    </div>
  )
}

function PickButton({ personaje, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Predecir a ${personaje.nombre}`}
      className="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1.5 text-[11px] font-medium text-fg-strong transition-colors hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      <PersonajeImg
        slug={personaje.slug}
        src={personaje.imagenUrl}
        nombre={personaje.nombre}
        alt={personaje.nombre}
        className="h-4 w-4 shrink-0 rounded object-cover object-top"
      />
      <span className="truncate">{personaje.nombre}</span>
    </button>
  )
}

function BracketSlot({ personaje, winner }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded px-2 py-1.5 ${
        winner ? 'bg-accent-soft' : ''
      }`}
    >
      <PersonajeImg
        slug={personaje.slug}
        src={personaje.imagenUrl}
        nombre={personaje.nombre}
        alt={personaje.nombre}
        loading="lazy"
        className="h-8 w-8 shrink-0 rounded object-cover object-top"
      />
      <span
        className={`min-w-0 flex-1 truncate text-[13px] font-medium ${
          winner ? 'text-fg-strong' : 'text-fg-muted'
        }`}
      >
        {personaje.nombre}
      </span>
      {winner && (
        <Trophy className="h-3 w-3 shrink-0 text-gold" aria-hidden="true" />
      )}
    </div>
  )
}

function ChampionSlot({ personaje }) {
  return (
    <div
      className="mt-3 flex flex-col items-center gap-2 rounded-xl border-2 border-accent/40 bg-accent-soft p-3"
      style={{ boxShadow: '0 0 30px rgb(159 29 44 / 0.25)' }}
    >
      <PersonajeImg
        slug={personaje.slug}
        alt={personaje.nombre}
        className="aspect-[2/3] w-full max-w-[130px] rounded-lg object-cover object-top"
      />
      <div className="text-center">
        <p className="text-sm font-bold text-fg-strong">{personaje.nombre}</p>
        <p className="text-[11px] text-fg-muted">{personaje.anime}</p>
      </div>
    </div>
  )
}

function ChampionPlaceholder() {
  return (
    <div className="mt-3 flex aspect-[2/3] max-w-[130px] flex-col items-center justify-center gap-2 self-center rounded-xl border-2 border-dashed border-border bg-surface-alt/40 p-3 text-center">
      <Lock className="h-5 w-5 text-fg-muted" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
        Por decidir
      </p>
      <p className="text-[10px] text-fg-muted">El torneo aún no ha terminado</p>
    </div>
  )
}

export default Bracket
