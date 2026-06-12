import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import PersonajeImg from '../../../components/PersonajeImg'
import { useReducedMotionPref } from '../../../hooks/useReducedMotionPref'
import './fight-bill.css'

/**
 * FightBill — «El cartel de la velada»: la cola visible de próximos duelos.
 *
 * Tira lateral (desktop ancho) / inferior con el combate ACTUAL como
 * titular con marco oro y los próximos N como mini-carteles (retratos 2:3
 * enfrentados en diagonal + 対 central). En reposo vive al 85% de opacidad
 * y NUNCA compite con el duelo en curso.
 *
 * CONTRATO DE COORDINACIÓN (cero carreras):
 *  - La coreografía se dispara por el CAMBIO DE `current.key` — da igual si
 *    el avance vino del voto del usuario o del auto-avance async de
 *    VotarPage: ambos mutan el mismo dato y la animación corre UNA sola vez
 *    por key (lastKeyRef compara; deps completas, sin disable).
 *  - Si llega un cambio de key mientras hay una transición en vuelo:
 *    el 1.º pendiente espera a que termine la actual (encadenado); del
 *    2.º pendiente en adelante se COALESCEN — se aplican en seco y solo
 *    se anima el salto al estado final. Así una ráfaga de 3 votos rápidos
 *    produce: anim(1) → anim(final), sin solapes.
 *  - El componente NO avanza la cola por sí mismo: es un espejo de las
 *    props. VotarPage sigue siendo el dueño del estado (prefetch + lote).
 *
 * Reduced-motion (gate único de la casa, PRM + calma): swap directo.
 * Perf: todas las fases son transform/opacity; alturas fijas (cero CLS);
 * imágenes lazy. Sin blur, sin filters, sin keyframes en runtime (todo
 * vive en fight-bill.css — CSP por hash).
 *
 * @param {object} props
 * @param {{key: string, a: Personaje, b: Personaje}} props.current
 *   Duelo en curso. `key` DEBE ser el id único del duelo (matchId del
 *   backend), nunca un índice. `Personaje`: { slug, nombre, imagen?,
 *   imagenUrl?, imagenColorDominante? }.
 * @param {Array<{key: string, a: Personaje, b: Personaje, destacado?: boolean}>} props.queue
 *   Próximos duelos en orden (0 = siguiente). `destacado` pinta el filo
 *   dorado discreto. Con 0 se muestra el estado «la arena respira»
 *   (skeleton .skl) hasta que el prefetch reponga.
 * @param {(duel: {key: string}) => void} [props.onJumpToDuel]
 *   Si el producto permite saltar a un duelo concreto, pásalo y cada
 *   cartel se renderiza como <button>. Si se omite, los carteles son
 *   presentacionales (li planos, sin foco). — DATO DE PRODUCTO NO
 *   CONFIRMADO: no pasar hasta que exista la decisión.
 * @param {'side'|'bottom'} [props.placement='side']
 *   'side' = columna lateral (desktop ancho); 'bottom' = tira horizontal
 *   con el titular a la izquierda. El host decide por breakpoint.
 * @param {boolean} [props.replenishing=false]
 *   true mientras el prefetch del siguiente está en vuelo y la cola quedó vacía.
 * @param {number} [props.maxSlots=3]
 *   Slots visibles/reservados (cero CLS). Hoy VotarPage prefetchea UN duelo
 *   → pasa 1; al cablear el lote /siguientes en el front, subir a 3.
 */
function FightBill({
  current,
  queue,
  onJumpToDuel,
  placement = 'side',
  replenishing = false,
  maxSlots = 3,
}) {
  // ── Estado visual desacoplado de props: lo que se VE durante la
  //    transición. `view` siempre converge a props cuando no hay anim.
  const [view, setView] = useState({ actual: current, cola: queue, phase: 'idle' })
  const reduceMotion = useReducedMotionPref()
  const animatingRef = useRef(false)
  const pendingRef = useRef([]) // snapshots de props pendientes (se coalescen)
  const timersRef = useRef([])
  const lastKeyRef = useRef(current.key)

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  const runTransition = useCallback(
    function run(snapshot) {
      const t = (fn, ms) => timersRef.current.push(setTimeout(fn, ms))
      const drainPending = () => {
        const next = pendingRef.current[0]
        if (!next) return
        const coalesced = pendingRef.current.coalesced
        pendingRef.current = []
        // Coalescido o no, siempre animamos el salto al snapshot más
        // reciente: los intermedios ya no existen (se pisaron), así la
        // ráfaga produce exactamente una segunda transición.
        t(() => run(next), coalesced ? 0 : 60)
      }
      if (reduceMotion) {
        setView({ actual: snapshot.actual, cola: snapshot.cola, phase: 'idle' })
        drainPending()
        return
      }
      animatingRef.current = true
      // F1 · corte de tinta: cover scaleX 0→1 origin-right, 240ms ease-brush
      setView((v) => ({ ...v, phase: 'cover-in' }))
      t(() => {
        // F2 · commit bajo el cover + inversión FLIP (sin transición)
        setView({ actual: snapshot.actual, cola: snapshot.cola, phase: 'invert' })
        // F3 (frame siguiente) · play: FLIP 300ms ease-lift stagger 40ms,
        // ghost de ascenso, retirada del cover con filo dorado (delay 120ms)
        t(() => setView((v) => ({ ...v, phase: 'play' })), 30)
        // F4 · settle a los ~470ms del commit (300 FLIP + 80 stagger + margen)
        t(() => {
          setView((v) => ({ ...v, phase: 'idle' }))
          animatingRef.current = false
          drainPending()
        }, 470)
      }, 240)
    },
    [reduceMotion],
  )

  // ── Disparo key-driven: lastKeyRef compara, las deps van completas.
  useLayoutEffect(() => {
    if (lastKeyRef.current === current.key) {
      // misma key: la cola pudo reponerse (prefetch) → sync sin corte
      setView((v) => (v.cola === queue ? v : { ...v, cola: queue }))
      return
    }
    lastKeyRef.current = current.key
    const snapshot = { actual: current, cola: queue }
    if (animatingRef.current) {
      // Encadenado/coalescencia: guardamos el snapshot; si ya había uno
      // pendiente lo PISAMOS (coalesce al estado final).
      const coalesced = pendingRef.current.length > 0
      pendingRef.current = [snapshot]
      if (coalesced) pendingRef.current.coalesced = true
      return
    }
    runTransition(snapshot)
  }, [current, queue, runTransition])

  const horizontal = placement === 'bottom'
  const empty = view.cola.length === 0
  const Cartel = onJumpToDuel ? 'button' : 'div'

  return (
    <aside
      aria-label="El cartel de la velada"
      className={`fb ${horizontal ? 'fb--bottom' : 'fb--side'} ${
        view.phase !== 'idle' ? 'fb--live' : ''
      } ${reduceMotion ? 'fb-rm' : ''}`}
      data-phase={view.phase}
      style={{ '--fb-slots': maxSlots }}
    >
      <p className="fb-eyebrow">
        <span className="fb-eyebrow-kanji" aria-hidden="true">番付</span>
        el cartel de la velada
      </p>

      <div className={horizontal ? 'flex items-stretch gap-2 overflow-x-auto' : ''}>
        {/* ── Titular: combate actual, marco oro ─────────────────────── */}
        <article className="fb-headliner" aria-label="Combate actual">
          <div className="fb-headliner-inner">
            <Retrato p={view.actual.a} side="a" size={horizontal ? 'xs' : 'md'} />
            <span className="fb-tai" aria-hidden="true">対</span>
            <Retrato p={view.actual.b} side="b" size={horizontal ? 'xs' : 'md'} />
          </div>
          <span className="fb-now font-mono">ahora</span>
          {/* Sello hanko re-keyed por duelo: se estampa una vez por key */}
          <span key={view.actual.key} className="fb-hanko" aria-hidden="true">戦</span>
          {!horizontal && (
            <div className="fb-headliner-names">
              <span>{view.actual.a.nombre}</span>
              <span>{view.actual.b.nombre}</span>
            </div>
          )}
          {/* Corte de tinta: cover + filo dorado 3px (estados via [data-phase]) */}
          <div className="fb-cover" aria-hidden="true" />
        </article>

        {/* ── Cola ────────────────────────────────────────────────────── */}
        {empty ? (
          <div className="fb-empty" role="status">
            <div className="fb-empty-card skl" />
            {!horizontal && maxSlots > 1 && <div className="fb-empty-card skl" />}
            <p className="fb-empty-label font-mono">
              {replenishing ? 'la arena respira — pidiendo el siguiente…' : 'la arena respira…'}
            </p>
          </div>
        ) : (
          <ol className="fb-list" aria-label="Próximos combates">
            {view.cola.slice(0, maxSlots).map((d, i) => (
              <li key={d.key} className="fb-slot" style={{ '--fb-i': i }}>
                <Cartel
                  {...(onJumpToDuel
                    ? {
                        type: 'button',
                        onClick: () => onJumpToDuel(d),
                        'aria-label': `Saltar al duelo ${d.a.nombre} contra ${d.b.nombre}`,
                      }
                    : {})}
                  className={`fb-cartel ${d.destacado ? 'fb-cartel--destacado' : ''} ${
                    onJumpToDuel ? 'fb-cartel--btn' : ''
                  }`}
                >
                  <Retrato p={d.a} side="a" size="xs" />
                  <span className="fb-cartel-names">
                    <span>{d.a.nombre}</span>
                    <span className="fb-tai fb-tai--sm" aria-hidden="true">対</span>
                    <span>{d.b.nombre}</span>
                  </span>
                  <Retrato p={d.b} side="b" size="xs" />
                </Cartel>
              </li>
            ))}
          </ol>
        )}

        {/* Ghost de ascenso: clon transform-only del promovido (F3) */}
        {(view.phase === 'invert' || view.phase === 'play') && (
          <div className="fb-ghost" aria-hidden="true">
            <span>{view.actual.a.nombre}</span>
            <span className="fb-tai fb-tai--sm">対</span>
            <span>{view.actual.b.nombre}</span>
          </div>
        )}
      </div>
    </aside>
  )
}

/** Retrato 2:3 lazy con el color dominante como base mientras carga. */
function Retrato({ p, side, size }) {
  return (
    <span className={`fb-retrato fb-retrato--${size} fb-retrato--${side}`}>
      <PersonajeImg
        slug={p.slug}
        src={p.imagenUrl ?? p.imagen}
        alt={p.nombre}
        colorDominante={p.imagenColorDominante ?? 'var(--color-surface)'}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </span>
  )
}

export default FightBill
