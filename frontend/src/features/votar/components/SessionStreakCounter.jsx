import { useEffect, useLayoutEffect, useRef } from 'react'
import { ENSO_PATH, ENSO_VIEWBOX } from '../../../lib/ensoPath'
import '../streak-counter.css'


// ease-stamp de los hanko es cubic-bezier(0.34,1.56,0.64,1); aquí el punch
// es 120ms sobre un numeral pequeño y el overshoot completo vibraba — se
// suaviza a 1.4 manteniendo la firma del sello.
const EASE_STAMP_SOFT = 'cubic-bezier(0.34, 1.4, 0.64, 1)'
// = var(--ease-brush). WAAPI no resuelve custom properties en `easing`,
// así que el valor va literal; si el token cambia en index.css, cambiar aquí.
const EASE_BRUSH = 'cubic-bezier(0.65, 0.05, 0.36, 1)'
const SR_THROTTLE_MS = 1000

function readSaved(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!Number.isInteger(data?.c) || data.c <= 0) return null
    return { count: data.c, lastVoteTs: Number(data.ts) || 0 }
  } catch {
    return null
  }
}

function tierFor(count, milestones) {
  let tier = 0
  for (let i = 0; i < milestones.length; i += 1) {
    if (count >= milestones[i]) tier = i + 1
  }
  return tier
}

/**
 * SessionStreakCounter — racha de votos de la sesión, en una esquina de la
 * arena. Lenguaje de federación: kanji 連 (cadena) pequeño en oro + numeral
 * grande en mono. Cada voto estampa un punch contenido; los hitos trazan un
 * ensō alrededor del numeral; sin votos el marcador baja a brasa y se duerme
 * (NUNCA se resetea: la cifra persiste en sessionStorage).
 *
 * <p>Render UNA vez: cero estado React por voto. Todo el tick va por refs +
 * WAAPI (suscripción imperativa al evento de voto vía `subscribe`), así que
 * el árbol de la arena no re-renderiza por racha (criterio 3). Cada punch
 * CANCELA al anterior — las ráfagas no encolan animaciones (criterio 1).
 * Restaurar sesión / volver de pestaña oculta pinta el estado final sin
 * animar (criterio 2). El ensō es UN path con dash (criterio 4).
 *
 * <p>Props:
 *   - subscribe: (listener: () => void) => () => void. REQUERIDA. Suscripción
 *     imperativa al evento "voto registrado" (en la casa: el CustomEvent
 *     VOTO_REGISTRADO_EVENT de lib/app-events, adaptado por el host). El componente llama listener-side, nunca re-renderiza.
 *   - milestones: number[] hitos que trazan ensō. Default [10, 25, 50].
 *     El último hito (>=3º) dibuja el trazo doble.
 *   - emberAfterMs: ms sin votar hasta bajar a brasa (opacity .4). Default 30 000.
 *   - sleepAfterMs: ms sin votar hasta apagarse (opacity 0). Default 120 000.
 *   - storageKey: clave de sessionStorage. Default 'animeshowdown.sessionStreak.v1'.
 *   - onMilestone: (hito: number) => void. Punto de integración del sonido:
 *     el host llama play('playStreakHito') de SoundContext (respeta el mute
 *     global). El componente NO sintetiza audio.
 *   - className: clases extra (posicionamiento de la esquina lo decide el host).
 *   - timeScale: number, SOLO dev/demo — acelera el reloj de decaimiento. Default 1.
 *   - reducedMotion: boolean|null, SOLO dev/demo — fuerza el modo estático.
 *     Default null = matchMedia('(prefers-reduced-motion: reduce)').
 *   - debug: ((api: { vote(): void, fastForward(ms: number): void }) => void)|null,
 *     SOLO dev/demo — recibe una API imperativa para las fases de la demo.
 *
 * <p>A11y: el ornamento entero es aria-hidden; la cifra viaja en un sr-only
 * role="status" ("racha de la sesión: N") con throttle de 1s. No es
 * interactivo (pointer-events: none), no participa del orden de foco.
 */
function SessionStreakCounter({
  subscribe,
  milestones = [10, 25, 50],
  emberAfterMs = 30000,
  sleepAfterMs = 120000,
  storageKey = 'animeshowdown.sessionStreak.v1',
  onMilestone = null,
  className = '',
  timeScale = 1,
  reducedMotion = null,
  debug = null,
}) {
  const rootRef = useRef(null)
  const numRef = useRef(null)
  const tickRef = useRef(null)
  const ring1Ref = useRef(null)
  const ring2Ref = useRef(null)
  const srRef = useRef(null)

  // callbacks por ref: su identidad no debe re-arrancar el controlador
  const onMilestoneRef = useRef(onMilestone)
  const debugRef = useRef(debug)
  useEffect(() => {
    onMilestoneRef.current = onMilestone
    debugRef.current = debug
  })

  const milestonesKey = milestones.join(',')

  useLayoutEffect(() => {
    const root = rootRef.current
    const num = numRef.current
    const tickLine = tickRef.current
    const rings = [ring1Ref.current, ring2Ref.current]
    const sr = srRef.current
    if (!root || !num || !rings[0]) return undefined

    const ms = milestonesKey.split(',').filter(Boolean).map(Number)
    const emberMs = Math.max(0, emberAfterMs / timeScale)
    const sleepMs = Math.max(emberMs, sleepAfterMs / timeScale)
    const mq =
      typeof matchMedia === 'function'
        ? matchMedia('(prefers-reduced-motion: reduce)')
        : null
    const isReduced = () =>
      reducedMotion != null ? reducedMotion : Boolean(mq?.matches)

    const st = { count: 0, lastVoteTs: 0 }
    let punchAnim = null
    let tickAnim = null
    let emberTimer = null
    let sleepTimer = null
    let srTimer = null
    let srDirty = false
    let noAnimRaf = 0

    const persist = () => {
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ c: st.count, ts: st.lastVoteTs }),
        )
      } catch {
        /* sin storage: la racha vive solo en memoria */
      }
    }

    const srWrite = () => {
      sr.textContent = st.count > 0 ? `racha de la sesión: ${st.count}` : ''
    }
    // throttle trailing: en ráfaga el lector anuncia como mucho 1 vez/s
    const srUpdate = () => {
      if (srTimer != null) {
        srDirty = true
        return
      }
      srWrite()
      srTimer = setTimeout(() => {
        srTimer = null
        if (srDirty) {
          srDirty = false
          srUpdate()
        }
      }, SR_THROTTLE_MS)
    }

    const setState = (s) => {
      root.dataset.state = s
    }

    // pinta un estado final SIN transiciones (restaurar sesión / volver de
    // pestaña oculta): clase kill-switch durante 2 frames
    const withoutTransitions = (fn) => {
      root.classList.add('streak-counter--no-anim')
      fn()
      cancelAnimationFrame(noAnimRaf)
      noAnimRaf = requestAnimationFrame(() => {
        noAnimRaf = requestAnimationFrame(() => {
          root.classList.remove('streak-counter--no-anim')
        })
      })
    }

    const resetRing = (ring) => {
      if (!ring) return
      ring.getAnimations().forEach((a) => a.cancel())
      ring.classList.remove('is-traced', 'is-resting')
      ring.style.strokeDashoffset = ''
    }
    // anillo ya ganado, en reposo (restauración: sin trazar)
    const restRing = (ring) => {
      if (!ring) return
      ring.getAnimations().forEach((a) => a.cancel())
      ring.style.strokeDashoffset = '0'
      ring.classList.add('is-traced', 'is-resting')
    }
    // ceremonia del hito: trazo 500ms ease-brush; al acabar decae a tinta
    // en reposo. fill:'both' cubre el delay; al terminar se fija el valor
    // inline y se CANCELA la animación (cero fills colgando — criterio 1).
    const traceRing = (ring, delayMs) => {
      if (!ring) return
      resetRing(ring)
      ring.classList.add('is-traced')
      const draw = ring.animate(
        [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
        { duration: 500, easing: EASE_BRUSH, delay: delayMs, fill: 'both' },
      )
      draw.finished
        .then(() => {
          ring.style.strokeDashoffset = '0'
          draw.cancel()
          ring.classList.add('is-resting')
        })
        .catch(() => {
          /* trazo cancelado por un hito posterior — estado lo fija el nuevo */
        })
    }

    const applyTier = (tier, { ceremony }) => {
      // el cuerpo del numeral sube 1pt por hito (21→24pt). Cambio de
      // font-size = layout, así que es un salto puntual (no se anima)
      // enmascarado por el trazo del ensō.
      root.dataset.tier = String(tier)
      if (!ceremony) {
        if (tier >= 1) restRing(rings[0])
        else resetRing(rings[0])
        if (tier >= 3) restRing(rings[1])
        else resetRing(rings[1])
      }
    }

    const scheduleDecay = () => {
      clearTimeout(emberTimer)
      clearTimeout(sleepTimer)
      if (st.count <= 0) {
        setState('empty')
        return
      }
      const elapsed = Date.now() - st.lastVoteTs
      if (elapsed >= sleepMs) {
        setState('asleep')
        return
      }
      if (elapsed >= emberMs) {
        setState('ember')
      } else {
        setState('live')
        emberTimer = setTimeout(() => setState('ember'), emberMs - elapsed)
      }
      sleepTimer = setTimeout(() => setState('asleep'), sleepMs - elapsed)
    }

    const punch = () => {
      // ráfaga más rápida que el punch: se cancela, no se encola
      punchAnim?.cancel()
      punchAnim = num.animate(
        [{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
        { duration: 120, easing: EASE_STAMP_SOFT },
      )
      if (tickLine) {
        tickAnim?.cancel()
        tickAnim = tickLine.animate(
          [{ opacity: 0.35 }, { opacity: 0.9 }, { opacity: 0.35 }],
          { duration: 180, easing: 'ease-out' },
        )
      }
    }

    const onVote = () => {
      st.count += 1
      st.lastVoteTs = Date.now()
      num.textContent = String(st.count)
      persist()
      srUpdate()
      // despertar sin drama: el mismo camino que cualquier voto
      scheduleDecay()
      if (!isReduced()) punch()
      const idx = ms.indexOf(st.count)
      if (idx !== -1) {
        const tier = idx + 1
        applyTier(tier, { ceremony: !isReduced() })
        if (!isReduced()) {
          traceRing(rings[0], 0)
          if (tier >= 3) traceRing(rings[1], 120)
        }
        onMilestoneRef.current?.(st.count)
      }
    }

    // ——— restauración: sessionStorage, sin animar ———
    const saved = readSaved(storageKey)
    if (saved) {
      st.count = saved.count
      st.lastVoteTs = saved.lastVoteTs
      num.textContent = String(st.count)
      withoutTransitions(() => {
        applyTier(tierFor(st.count, ms), { ceremony: false })
        scheduleDecay()
      })
      srWrite()
    } else {
      num.textContent = '0'
      applyTier(0, { ceremony: false })
      setState('empty')
      srWrite()
    }

    // pestaña oculta: timers fuera; al volver, estado recalculado sin animar
    const onVisibility = () => {
      if (document.hidden) {
        clearTimeout(emberTimer)
        clearTimeout(sleepTimer)
      } else {
        withoutTransitions(scheduleDecay)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const unsubscribe =
      typeof subscribe === 'function' ? subscribe(onVote) : undefined

    debugRef.current?.({
      vote: onVote,
      fastForward: (msAgo) => {
        st.lastVoteTs -= msAgo
        persist()
        scheduleDecay()
      },
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimeout(emberTimer)
      clearTimeout(sleepTimer)
      clearTimeout(srTimer)
      cancelAnimationFrame(noAnimRaf)
      punchAnim?.cancel()
      tickAnim?.cancel()
      rings.forEach((r) => r?.getAnimations().forEach((a) => a.cancel()))
      debugRef.current?.(null)
    }
  }, [
    subscribe,
    storageKey,
    milestonesKey,
    emberAfterMs,
    sleepAfterMs,
    timeScale,
    reducedMotion,
  ])

  return (
    <div
      ref={rootRef}
      className={`streak-counter ${className}`}
      data-state="empty"
      data-tier="0"
    >
      <span ref={srRef} className="sr-only" role="status" aria-live="polite"></span>
      <div className="streak-counter__visual" aria-hidden="true">
        <span className="streak-counter__kanji" lang="ja">連</span>
        <span className="streak-counter__num-wrap">
          <svg
            className="streak-counter__enso"
            viewBox={ENSO_VIEWBOX}
            preserveAspectRatio="none"
            focusable="false"
            aria-hidden="true"
          >
            <path
              ref={ring1Ref}
              className="streak-counter__enso-path"
              d={ENSO_PATH}
              pathLength="1"
              vectorEffect="non-scaling-stroke"
            ></path>
            <path
              ref={ring2Ref}
              className="streak-counter__enso-path streak-counter__enso-path--double"
              d={ENSO_PATH}
              pathLength="1"
              vectorEffect="non-scaling-stroke"
              transform="rotate(11 60 60)"
            ></path>
          </svg>
          <span ref={numRef} className="streak-counter__num">0</span>
          <span ref={tickRef} className="streak-counter__tick"></span>
        </span>
      </div>
    </div>
  )
}

export default SessionStreakCounter
