/**
 * duel-entrance-core.js — "La entrada de combatientes" (DuelEntrance)
 *
 * Timings + coreógrafo WAAPI de la entrada del par en /votar.
 * ÚNICA fuente de verdad temporal (patrón verdict-timing.js):
 * DuelEntrance.jsx lo consume en runtime y los tests de coreografía
 * importan de aquí. Framework-agnóstico: recibe nodos (refs), lanza
 * Web Animations y timers de fase, devuelve cancel(). Cero re-render
 * por frame; estado base del DOM = estado FINAL (reduced-motion,
 * print y no-JS pintan el par directo, gratis).
 *
 * Ubicación sugerida: src/features/votar/duel-entrance-core.js
 * Curvas espejo de index.css en formato WAAPI (string), como en
 * verdict-timing.js.
 */

export const EASE_LIFT = 'cubic-bezier(0.16, 1, 0.3, 1)'
export const EASE_BRUSH = 'cubic-bezier(0.65, 0.05, 0.36, 1)'
export const EASE_STAMP = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export const ENTRANCE_T = {
  /** t0 → t+480: caminata (translateX + 2 micro-pasos translateY). */
  walkMs: 480,
  walkFromPct: 12,
  /** t+120: la carta derecha arranca. */
  stepLagMs: 120,
  /** t+420 → t+540: squash de plantarse (1.04/0.96 → 1). */
  squashAtMs: 420,
  squashMs: 120,
  /** t+520: el VS nace (scaleY 0→1 origin-center). */
  vsAtMs: 520,
  vsMs: 180,
  /** t+700: destello de filo tras nacer el VS. */
  flashAtMs: 700,
  flashMs: 120,
  /** t+600: nombres por corte de tinta, stagger 60ms. */
  namesAtMs: 600,
  nameMs: 240,
  nameStaggerMs: 60,
  /** Salida del par: UN paso atrás con fade. */
  exitMs: 220,
  exitStepPct: 4,
  /** Modo rápido: la entrada entera es un fade de 120ms. */
  fastFadeMs: 120,
  /** Par nuevo (auto-avance): misma ceremonia al 70%. */
  reEntryScale: 0.7,
  /** Fin de la pieza (nombres asentados): 600 + 60 + 240. */
  totalMs: 900,
}

/* Timeline de una figura: caminata + 2 micro-pasos + squash de plantarse,
   en UNA sola animación (translate y scale compuestos en transform — nunca
   dos animations peleando por la misma propiedad).
   Duración del efecto = squashAt + squash (540ms a escala 1):
     0.00 → arranque lateral (±12%), opacity 0
     0.12 → ya visible
     0.25/0.46/0.66/0.78 → los dos micro-pasos de translateY
     0.89 (≈480ms) → pisa el centro con squash 1.04/0.96
     1.00 (≈540ms) → asienta en escala 1 */
export function figureWalkFrames(dirSign, axis) {
  const tx = (pct) =>
    axis === 'y'
      ? `translateY(${dirSign * pct}%)`
      : `translateX(${dirSign * pct}%)`
  const step = (px) =>
    axis === 'y' ? `translateX(${px}px)` : `translateY(${px}px)`
  return [
    { offset: 0.0, transform: `${tx(12)} ${step(0)} scale(1, 1)`, opacity: 0 },
    { offset: 0.12, transform: `${tx(10.4)} ${step(-2)} scale(1, 1)`, opacity: 1 },
    { offset: 0.25, transform: `${tx(8.2)} ${step(-5)} scale(1, 1)`, opacity: 1 },
    { offset: 0.46, transform: `${tx(5)} ${step(0)} scale(1, 1)`, opacity: 1 },
    { offset: 0.66, transform: `${tx(2.2)} ${step(-3)} scale(1, 1)`, opacity: 1 },
    { offset: 0.78, transform: `${tx(0.6)} ${step(0)} scale(1, 1)`, opacity: 1 },
    {
      offset: 0.89,
      transform: `${tx(0)} ${step(0)} scale(1.04, 0.96)`,
      opacity: 1,
    },
    { offset: 1.0, transform: `${tx(0)} ${step(0)} scale(1, 1)`, opacity: 1 },
  ]
}

/**
 * Lanza la ceremonia de entrada.
 * @param {object} els nodos: { leftFigure, rightFigure, vsLine, vsFlash,
 *   leftCover, rightCover } — cualquiera puede faltar (arte faltante,
 *   móvil sin flash…), el coreógrafo lo salta.
 * @param {object} opts
 *   scale       1 = primera ceremonia · 0.7 = par nuevo de auto-avance
 *   axis        'x' (escritorio) | 'y' (390px apilado)
 *   fast        modo rápido del repo: fade de 120ms y fuera
 *   reduceMotion  par pintado directo, VS estático
 *   startAtMs   replay desde una fase (delay negativo WAAPI; lo ya pasado
 *               queda en su estado base = final)
 *   onPhase(name)  'left-in'|'right-in'|'plant'|'vs'|'names'|'flash'|'done'
 *   onDone()
 * @returns {() => void} cancel — corta animaciones y timers (el DOM cae a
 *   su estado base, que es el final: jamás deja la arena a medias).
 */
export function runDuelEntrance(els, opts = {}) {
  const {
    scale = 1,
    axis = 'x',
    fast = false,
    reduceMotion = false,
    startAtMs = 0,
    onPhase = () => {},
    onDone = () => {},
  } = opts
  const anims = []
  const timers = []
  let cancelled = false
  const cancel = () => {
    if (cancelled) return
    cancelled = true
    anims.forEach((a) => a.cancel())
    timers.forEach(clearTimeout)
  }
  const s = (ms) => Math.round(ms * scale)
  const phaseAt = (ms, name) => {
    const t = s(ms) - startAtMs
    if (t < 0) return
    timers.push(setTimeout(() => onPhase(name), t))
  }
  const finishAt = (ms) => {
    const t = Math.max(0, s(ms) - startAtMs)
    timers.push(
      setTimeout(() => {
        onPhase('done')
        onDone()
      }, t),
    )
  }
  const animate = (el, frames, { dur, delay = 0, easing = EASE_LIFT }) => {
    // jsdom / navegadores sin WAAPI: la ceremonia se salta (base = final).
    if (!el || typeof el.animate !== 'function') return null
    const d = delay - startAtMs
    if (d + dur <= 0) return null // fase ya consumida: base = estado final
    const a = el.animate(frames, {
      duration: dur,
      delay: d,
      easing,
      fill: 'backwards',
    })
    anims.push(a)
    return a
  }

  if (reduceMotion) {
    // Par pintado directo, VS estático, nombres visibles (estado base).
    finishAt(0)
    return cancel
  }

  if (fast) {
    // La cadencia de votar manda: fade único de 120ms, cero ceremonia.
    ;[els.leftFigure, els.rightFigure].forEach((el) =>
      animate(el, [{ opacity: 0 }, { opacity: 1 }], {
        dur: ENTRANCE_T.fastFadeMs,
        easing: 'ease-out',
      }),
    )
    finishAt(ENTRANCE_T.fastFadeMs / scale) // fastFade NO escala
    return cancel
  }

  const T = ENTRANCE_T
  const figDur = s(T.squashAtMs + T.squashMs) // 540 a escala 1

  animate(els.leftFigure, figureWalkFrames(-1, axis), {
    dur: figDur,
    easing: EASE_LIFT,
  })
  animate(els.rightFigure, figureWalkFrames(1, axis), {
    dur: figDur,
    delay: s(T.stepLagMs),
    easing: EASE_LIFT,
  })

  const vsAxis = axis === 'y' ? 'scaleX' : 'scaleY'
  animate(
    els.vsLine,
    [{ transform: `${vsAxis}(0)` }, { transform: `${vsAxis}(1)` }],
    { dur: s(T.vsMs), delay: s(T.vsAtMs), easing: EASE_LIFT },
  )
  animate(
    els.vsFlash,
    [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.35 },
      { opacity: 0, offset: 1 },
    ],
    { dur: s(T.flashMs), delay: s(T.flashAtMs), easing: 'ease-out' },
  )
  ;[els.leftCover, els.rightCover].forEach((cover, i) =>
    animate(cover, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
      dur: s(T.nameMs),
      delay: s(T.namesAtMs + i * T.nameStaggerMs),
      easing: EASE_BRUSH,
    }),
  )

  phaseAt(0, 'left-in')
  phaseAt(T.stepLagMs, 'right-in')
  phaseAt(T.squashAtMs, 'plant')
  phaseAt(T.vsAtMs, 'vs')
  phaseAt(T.namesAtMs, 'names')
  phaseAt(T.flashAtMs, 'flash')
  finishAt(T.totalMs)
  return cancel
}

/**
 * Salida del par (auto-avance): UN paso atrás con fade, 220ms.
 * @param {object} els { leftFigure, rightFigure, alsoFade?: Node[] }
 * @param {object} opts { axis, fast, reduceMotion, onDone }
 * @returns {() => void} cancel
 */
export function runDuelExit(els, opts = {}) {
  const { axis = 'x', fast = false, reduceMotion = false, onDone = () => {} } = opts
  const anims = []
  let timer = null
  const cancel = () => {
    anims.forEach((a) => a.cancel())
    if (timer != null) clearTimeout(timer)
  }
  const dur = fast ? ENTRANCE_T.fastFadeMs : ENTRANCE_T.exitMs
  if (reduceMotion) {
    onDone()
    return cancel
  }
  const back = (dirSign) =>
    axis === 'y'
      ? `translateY(${dirSign * ENTRANCE_T.exitStepPct}%)`
      : `translateX(${dirSign * ENTRANCE_T.exitStepPct}%)`
  const run = (el, frames) => {
    if (!el || typeof el.animate !== 'function') return
    anims.push(el.animate(frames, { duration: dur, easing: EASE_BRUSH, fill: 'forwards' }))
  }
  if (fast) {
    ;[els.leftFigure, els.rightFigure, ...(els.alsoFade || [])].forEach((el) =>
      run(el, [{ opacity: 1 }, { opacity: 0 }]),
    )
  } else {
    run(els.leftFigure, [
      { transform: 'translate(0,0)', opacity: 1 },
      { transform: back(-1), opacity: 0 },
    ])
    run(els.rightFigure, [
      { transform: 'translate(0,0)', opacity: 1 },
      { transform: back(1), opacity: 0 },
    ])
    ;(els.alsoFade || []).forEach((el) => run(el, [{ opacity: 1 }, { opacity: 0 }]))
  }
  timer = setTimeout(onDone, dur)
  return cancel
}
