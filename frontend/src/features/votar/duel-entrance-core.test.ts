import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EASE_BRUSH,
  EASE_LIFT,
  EASE_STAMP,
  ENTRANCE_T,
  figureWalkFrames,
  runDuelEntrance,
  runDuelExit,
} from './duel-entrance-core'

/**
 * Fábrica de "elemento" framework-agnóstico para el coreógrafo: happy-dom no
 * implementa Element.animate, así que el core lo trataría como "sin WAAPI" y
 * se saltaría la ceremonia. Aquí registramos cada llamada a .animate y
 * exponemos un cancel espía por animación, espejo de lo que hace el core.
 */
function fakeEl() {
  const calls: Array<{ frames: unknown; opts: Record<string, unknown> }> = []
  const cancels: Array<ReturnType<typeof vi.fn>> = []
  const el = {
    calls,
    cancels,
    animate(frames: unknown, opts: Record<string, unknown>) {
      const cancel = vi.fn()
      cancels.push(cancel)
      calls.push({ frames, opts })
      return { cancel }
    },
  }
  return el
}

describe('figureWalkFrames — coreografía pura de la caminata', () => {
  it('eje x, dirSign -1: 8 frames con translateX firmado y squash al plantarse', () => {
    expect(figureWalkFrames(-1, 'x')).toEqual([
      { offset: 0.0, transform: 'translateX(-12%) translateY(0px) scale(1, 1)', opacity: 0 },
      { offset: 0.12, transform: 'translateX(-10.4%) translateY(-2px) scale(1, 1)', opacity: 1 },
      { offset: 0.25, transform: 'translateX(-8.2%) translateY(-5px) scale(1, 1)', opacity: 1 },
      { offset: 0.46, transform: 'translateX(-5%) translateY(0px) scale(1, 1)', opacity: 1 },
      { offset: 0.66, transform: 'translateX(-2.2%) translateY(-3px) scale(1, 1)', opacity: 1 },
      { offset: 0.78, transform: 'translateX(-0.6%) translateY(0px) scale(1, 1)', opacity: 1 },
      { offset: 0.89, transform: 'translateX(0%) translateY(0px) scale(1.04, 0.96)', opacity: 1 },
      { offset: 1.0, transform: 'translateX(0%) translateY(0px) scale(1, 1)', opacity: 1 },
    ])
  })

  it('dirSign +1 es el espejo lateral exacto de -1 (mismos micro-pasos, signo opuesto en %)', () => {
    const left = figureWalkFrames(-1, 'x')
    const right = figureWalkFrames(1, 'x')
    expect(right.length).toBe(left.length)
    right.forEach((frame, i) => {
      expect(frame.offset).toBe(left[i].offset)
      expect(frame.opacity).toBe(left[i].opacity)
      // El signo del % se invierte; los micro-pasos en px y el scale no.
      expect(frame.transform).toBe(left[i].transform.replace(/translateX\((-?[\d.]+)%\)/, (_m, n) => `translateX(${-Number(n)}%)`))
    })
    expect(right[0].transform).toBe('translateX(12%) translateY(0px) scale(1, 1)')
  })

  it("eje y: el desplazamiento principal va en translateY y los micro-pasos en translateX", () => {
    const frames = figureWalkFrames(1, 'y')
    expect(frames[0].transform).toBe('translateY(12%) translateX(0px) scale(1, 1)')
    expect(frames[1].transform).toBe('translateY(10.4%) translateX(-2px) scale(1, 1)')
    expect(frames[6].transform).toBe('translateY(0%) translateX(0px) scale(1.04, 0.96)')
    expect(frames[7].transform).toBe('translateY(0%) translateX(0px) scale(1, 1)')
  })

  it('arranca invisible y termina visible y asentado en todos los ejes/sentidos', () => {
    for (const dir of [-1, 1] as const) {
      for (const axis of ['x', 'y'] as const) {
        const frames = figureWalkFrames(dir, axis)
        expect(frames[0].opacity).toBe(0)
        expect(frames.at(-1)?.opacity).toBe(1)
        expect(frames.at(-1)?.transform).toContain('scale(1, 1)')
      }
    }
  })
})

describe('ENTRANCE_T + curvas — tabla temporal coherente', () => {
  it('las curvas WAAPI son las firmas espejo de index.css', () => {
    expect(EASE_LIFT).toBe('cubic-bezier(0.16, 1, 0.3, 1)')
    expect(EASE_BRUSH).toBe('cubic-bezier(0.65, 0.05, 0.36, 1)')
    expect(EASE_STAMP).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)')
  })

  it('totalMs es exactamente cuando asienta el último nombre (namesAt + stagger + nameMs)', () => {
    expect(ENTRANCE_T.totalMs).toBe(
      ENTRANCE_T.namesAtMs + ENTRANCE_T.nameStaggerMs + ENTRANCE_T.nameMs,
    )
    expect(ENTRANCE_T.totalMs).toBe(900)
  })

  it('la duración de la figura (squashAt + squash) es 540ms a escala 1', () => {
    expect(ENTRANCE_T.squashAtMs + ENTRANCE_T.squashMs).toBe(540)
  })
})

describe('runDuelEntrance — el coreógrafo de la entrada', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reduceMotion: ni anima ni dispara fases intermedias, solo done en t=0', () => {
    vi.useFakeTimers()
    const onPhase = vi.fn()
    const onDone = vi.fn()
    const left = fakeEl()
    const right = fakeEl()
    runDuelEntrance({ leftFigure: left, rightFigure: right }, {
      reduceMotion: true,
      onPhase,
      onDone,
    })
    expect(left.calls).toHaveLength(0)
    expect(right.calls).toHaveLength(0)
    vi.runAllTimers()
    expect(onPhase).toHaveBeenCalledTimes(1)
    expect(onPhase).toHaveBeenCalledWith('done')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('fast: un solo fade de opacidad en las tres figuras y done al fastFadeMs', () => {
    vi.useFakeTimers()
    const onPhase = vi.fn()
    const onDone = vi.fn()
    const left = fakeEl()
    const right = fakeEl()
    const vsCompact = fakeEl()
    runDuelEntrance(
      { leftFigure: left, rightFigure: right, vsCompact },
      { fast: true, onPhase, onDone },
    )
    for (const el of [left, right, vsCompact]) {
      expect(el.calls).toHaveLength(1)
      expect(el.calls[0].frames).toEqual([{ opacity: 0 }, { opacity: 1 }])
      expect(el.calls[0].opts.duration).toBe(ENTRANCE_T.fastFadeMs)
      expect(el.calls[0].opts.easing).toBe('ease-out')
    }
    vi.advanceTimersByTime(ENTRANCE_T.fastFadeMs)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onPhase).toHaveBeenLastCalledWith('done')
  })

  it('ceremonia completa: figuras con figDur, lag de la derecha, VS y portadas cronometrados', () => {
    vi.useFakeTimers()
    const els = {
      leftFigure: fakeEl(),
      rightFigure: fakeEl(),
      vsLine: fakeEl(),
      vsFlash: fakeEl(),
      vsCompact: fakeEl(),
      leftCover: fakeEl(),
      rightCover: fakeEl(),
    }
    runDuelEntrance(els, {})

    const figDur = ENTRANCE_T.squashAtMs + ENTRANCE_T.squashMs
    expect(els.leftFigure.calls[0].opts).toMatchObject({
      duration: figDur,
      delay: 0,
      easing: EASE_LIFT,
      fill: 'backwards',
    })
    expect(els.rightFigure.calls[0].opts).toMatchObject({
      duration: figDur,
      delay: ENTRANCE_T.stepLagMs,
      easing: EASE_LIFT,
    })
    // VS nace en vsAtMs con su propia duración.
    expect(els.vsLine.calls[0].opts).toMatchObject({
      duration: ENTRANCE_T.vsMs,
      delay: ENTRANCE_T.vsAtMs,
    })
    // escritorio (axis 'x') => el VS crece en scaleY.
    expect(els.vsLine.calls[0].frames).toEqual([
      { transform: 'scaleY(0)' },
      { transform: 'scaleY(1)' },
    ])
    // Portadas con stagger: la izquierda en namesAt, la derecha +stagger.
    expect(els.leftCover.calls[0].opts.delay).toBe(ENTRANCE_T.namesAtMs)
    expect(els.rightCover.calls[0].opts.delay).toBe(
      ENTRANCE_T.namesAtMs + ENTRANCE_T.nameStaggerMs,
    )
    expect(els.leftCover.calls[0].opts.easing).toBe(EASE_BRUSH)
  })

  it('axis y: el VS crece en scaleX en lugar de scaleY', () => {
    vi.useFakeTimers()
    const vsLine = fakeEl()
    runDuelEntrance({ vsLine }, { axis: 'y' })
    expect(vsLine.calls[0].frames).toEqual([
      { transform: 'scaleX(0)' },
      { transform: 'scaleX(1)' },
    ])
  })

  it('emite las fases en orden cronológico hasta done en totalMs', () => {
    vi.useFakeTimers()
    const seen: string[] = []
    runDuelEntrance(
      { leftFigure: fakeEl(), rightFigure: fakeEl() },
      { onPhase: (name) => seen.push(name) },
    )
    vi.runAllTimers()
    expect(seen).toEqual([
      'left-in',
      'right-in',
      'plant',
      'vs',
      'names',
      'flash',
      'done',
    ])
  })

  it('scale 0.7: timers y duraciones se reescalan (re-entry de auto-avance)', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const right = fakeEl()
    runDuelEntrance(
      { leftFigure: fakeEl(), rightFigure: right },
      { scale: ENTRANCE_T.reEntryScale, onDone },
    )
    const scaled = (ms: number) => Math.round(ms * ENTRANCE_T.reEntryScale)
    expect(right.calls[0].opts.delay).toBe(scaled(ENTRANCE_T.stepLagMs))
    expect(right.calls[0].opts.duration).toBe(
      scaled(ENTRANCE_T.squashAtMs + ENTRANCE_T.squashMs),
    )
    vi.advanceTimersByTime(scaled(ENTRANCE_T.totalMs) - 1)
    expect(onDone).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('cancel(): aborta cada animación y silencia las fases pendientes (arena nunca a medias)', () => {
    vi.useFakeTimers()
    const onPhase = vi.fn()
    const onDone = vi.fn()
    const left = fakeEl()
    const right = fakeEl()
    const cancel = runDuelEntrance({ leftFigure: left, rightFigure: right }, {
      onPhase,
      onDone,
    })
    cancel()
    for (const c of [...left.cancels, ...right.cancels]) {
      expect(c).toHaveBeenCalledTimes(1)
    }
    vi.runAllTimers()
    expect(onPhase).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    // cancel idempotente: una segunda llamada no re-cancela las animaciones.
    cancel()
    for (const c of [...left.cancels, ...right.cancels]) {
      expect(c).toHaveBeenCalledTimes(1)
    }
  })

  it('startAtMs: las fases ya consumidas no se reemiten al hacer replay', () => {
    vi.useFakeTimers()
    const seen: string[] = []
    runDuelEntrance(
      { leftFigure: fakeEl(), rightFigure: fakeEl() },
      { startAtMs: ENTRANCE_T.vsAtMs, onPhase: (name) => seen.push(name) },
    )
    vi.runAllTimers()
    // left-in/right-in/plant (en t<vsAt) quedan en estado base, no se emiten.
    expect(seen).not.toContain('left-in')
    expect(seen).not.toContain('plant')
    expect(seen).toContain('vs')
    expect(seen.at(-1)).toBe('done')
  })

  it('elementos sin animate (arte faltante) se saltan sin reventar', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    expect(() =>
      runDuelEntrance({ leftFigure: null, vsLine: undefined }, { onDone }),
    ).not.toThrow()
    vi.runAllTimers()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

describe('runDuelExit — el paso atrás de salida', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reduceMotion: resuelve onDone de inmediato sin animar', () => {
    const onDone = vi.fn()
    const left = fakeEl()
    runDuelExit({ leftFigure: left }, { reduceMotion: true, onDone })
    expect(left.calls).toHaveLength(0)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('normal: un paso atrás firmado con fade y onDone al exitMs', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const left = fakeEl()
    const right = fakeEl()
    runDuelExit({ leftFigure: left, rightFigure: right }, { onDone })
    expect(left.calls[0].frames).toEqual([
      { transform: 'translate(0,0)', opacity: 1 },
      { transform: `translateX(${-ENTRANCE_T.exitStepPct}%)`, opacity: 0 },
    ])
    expect(right.calls[0].frames).toEqual([
      { transform: 'translate(0,0)', opacity: 1 },
      { transform: `translateX(${ENTRANCE_T.exitStepPct}%)`, opacity: 0 },
    ])
    expect(left.calls[0].opts).toMatchObject({
      duration: ENTRANCE_T.exitMs,
      easing: EASE_BRUSH,
      fill: 'forwards',
    })
    vi.advanceTimersByTime(ENTRANCE_T.exitMs)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('axis y: el paso atrás va en translateY', () => {
    vi.useFakeTimers()
    const left = fakeEl()
    runDuelExit({ leftFigure: left }, { axis: 'y' })
    expect(left.calls[0].frames[1]).toEqual({
      transform: `translateY(${-ENTRANCE_T.exitStepPct}%)`,
      opacity: 0,
    })
  })

  it('fast: solo fade de opacidad (figuras + alsoFade) y onDone al fastFadeMs', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const left = fakeEl()
    const extra = fakeEl()
    runDuelExit(
      { leftFigure: left, rightFigure: fakeEl(), alsoFade: [extra] },
      { fast: true, onDone },
    )
    expect(left.calls[0].frames).toEqual([{ opacity: 1 }, { opacity: 0 }])
    expect(left.calls[0].opts.duration).toBe(ENTRANCE_T.fastFadeMs)
    expect(extra.calls[0].frames).toEqual([{ opacity: 1 }, { opacity: 0 }])
    vi.advanceTimersByTime(ENTRANCE_T.fastFadeMs)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('alsoFade en modo normal recibe un fade puro (sin paso lateral)', () => {
    vi.useFakeTimers()
    const extra = fakeEl()
    runDuelExit({ leftFigure: fakeEl(), alsoFade: [extra] }, {})
    expect(extra.calls[0].frames).toEqual([{ opacity: 1 }, { opacity: 0 }])
  })

  it('cancel(): aborta animaciones y desactiva el onDone pendiente', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const left = fakeEl()
    const cancel = runDuelExit({ leftFigure: left }, { onDone })
    cancel()
    expect(left.cancels[0]).toHaveBeenCalledTimes(1)
    vi.runAllTimers()
    expect(onDone).not.toHaveBeenCalled()
  })
})
