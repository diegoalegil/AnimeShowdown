import { describe, expect, it, vi } from 'vitest'
import {
  TOP5_CANVAS_THEME,
  drawTop5Background,
  drawTop5Numeral,
  KANJI_RANGO,
  KANJI_SERIF_STACK,
} from './top5-canvas-theme'

// Test DESACOPLADO del pintor canvas de Mi Top 5: en vez de un canvas real,
// usa un stub plano de CanvasRenderingContext2D que registra cada llamada a
// método y cada propiedad asignada. Así verificamos la forma del dibujo
// (qué primitivas se invocan, con qué argumentos) sin depender de happy-dom
// ni de un contexto 2D real. NO toca código de producción.

type Llamada = { metodo: string; args: unknown[] }

interface CtxStub {
  llamadas: Llamada[]
  // Propiedades de estilo que el pintor asigna (registramos el historial).
  fillStyleSets: unknown[]
  strokeStyleSets: unknown[]
  fontSets: unknown[]
  lineWidthSets: unknown[]
  textAlignSets: unknown[]
  textBaselineSets: unknown[]
  fillStyle: unknown
  strokeStyle: unknown
  font: unknown
  lineWidth: unknown
  textAlign: unknown
  textBaseline: unknown
  [metodo: string]: unknown
}

/**
 * Fabrica un stub de ctx 2D: cada método es un vi.fn() que apunta su nombre y
 * argumentos en `llamadas`; cada setter de estilo guarda su historial y el
 * último valor. Plain object, cero dependencias del DOM.
 */
function crearCtxStub(): CtxStub {
  const llamadas: Llamada[] = []
  const fillStyleSets: unknown[] = []
  const strokeStyleSets: unknown[] = []
  const fontSets: unknown[] = []
  const lineWidthSets: unknown[] = []
  const textAlignSets: unknown[] = []
  const textBaselineSets: unknown[] = []

  const metodo = (nombre: string) =>
    vi.fn((...args: unknown[]) => {
      llamadas.push({ metodo: nombre, args })
    })

  let fillStyle: unknown
  let strokeStyle: unknown
  let font: unknown
  let lineWidth: unknown
  let textAlign: unknown
  let textBaseline: unknown

  return {
    llamadas,
    fillStyleSets,
    strokeStyleSets,
    fontSets,
    lineWidthSets,
    textAlignSets,
    textBaselineSets,
    save: metodo('save'),
    restore: metodo('restore'),
    fillRect: metodo('fillRect'),
    strokeRect: metodo('strokeRect'),
    beginPath: metodo('beginPath'),
    closePath: metodo('closePath'),
    moveTo: metodo('moveTo'),
    lineTo: metodo('lineTo'),
    arc: metodo('arc'),
    fill: metodo('fill'),
    stroke: metodo('stroke'),
    fillText: metodo('fillText'),
    get fillStyle() {
      return fillStyle
    },
    set fillStyle(v) {
      fillStyle = v
      fillStyleSets.push(v)
    },
    get strokeStyle() {
      return strokeStyle
    },
    set strokeStyle(v) {
      strokeStyle = v
      strokeStyleSets.push(v)
    },
    get font() {
      return font
    },
    set font(v) {
      font = v
      fontSets.push(v)
    },
    get lineWidth() {
      return lineWidth
    },
    set lineWidth(v) {
      lineWidth = v
      lineWidthSets.push(v)
    },
    get textAlign() {
      return textAlign
    },
    set textAlign(v) {
      textAlign = v
      textAlignSets.push(v)
    },
    get textBaseline() {
      return textBaseline
    },
    set textBaseline(v) {
      textBaseline = v
      textBaselineSets.push(v)
    },
  } as unknown as CtxStub
}

const nombresLlamados = (ctx: CtxStub) => ctx.llamadas.map((l) => l.metodo)
const llamadasDe = (ctx: CtxStub, metodo: string) =>
  ctx.llamadas.filter((l) => l.metodo === metodo)

describe('TOP5_CANVAS_THEME — forma y valores del tema', () => {
  it('expone numerales kanji 一..五 y un stack serif CJK', () => {
    expect(KANJI_RANGO).toEqual(['一', '二', '三', '四', '五'])
    expect(KANJI_RANGO).toHaveLength(5)
    expect(KANJI_SERIF_STACK).toContain('serif')
    expect(typeof KANJI_SERIF_STACK).toBe('string')
  })

  it('expone todas las claves de color esperadas (compat + firma carmesí/oro)', () => {
    const claves = [
      // compat con el dibujo previo
      'background',
      'text',
      'muted',
      'accent',
      'watermark',
      'cardFill',
      'cardStroke',
      'auroraStart',
      'auroraEnd',
      // firma carmesí/oro
      'gold',
      'goldHairline',
      'goldRule',
      'bladeSoft',
      'bladeStrong',
      'kanjiWatermark',
      'numeralChip',
      'numeralStroke',
      'cardStrokeUno',
      'auraUno',
    ]
    for (const clave of claves) {
      expect(TOP5_CANVAS_THEME).toHaveProperty(clave)
    }
  })

  it('cada token resuelve a una cadena de color no vacía (getter perezoso)', () => {
    const valores = [
      TOP5_CANVAS_THEME.background,
      TOP5_CANVAS_THEME.text,
      TOP5_CANVAS_THEME.muted,
      TOP5_CANVAS_THEME.accent,
      TOP5_CANVAS_THEME.gold,
      TOP5_CANVAS_THEME.cardFill,
    ]
    for (const v of valores) {
      expect(typeof v).toBe('string')
      expect((v as string).length).toBeGreaterThan(0)
    }
  })

  it('las variantes con alfa se expresan como rgb(... / a) sobre el token base', () => {
    // conAlpha convierte el fallback hex a rgb(r g b / alpha).
    expect(TOP5_CANVAS_THEME.watermark).toMatch(/^rgb\([\d ]+\/ 0\.6\)$/)
    expect(TOP5_CANVAS_THEME.auroraEnd).toMatch(/\/ 0\)$/)
    expect(TOP5_CANVAS_THEME.kanjiWatermark).toMatch(/\/ 0\.05\)$/)
    expect(TOP5_CANVAS_THEME.cardStrokeUno).toMatch(/\/ 0\.85\)$/)
  })
})

describe('drawTop5Background — fondo «corte carmesí»', () => {
  it('balancea save/restore y pinta el lienzo de fondo completo', () => {
    const ctx = crearCtxStub()
    drawTop5Background(ctx as unknown as CanvasRenderingContext2D, {
      width: 1200,
      height: 630,
    })

    const nombres = nombresLlamados(ctx)
    expect(nombres[0]).toBe('save')
    expect(nombres[nombres.length - 1]).toBe('restore')
    expect(llamadasDe(ctx, 'save')).toHaveLength(1)
    expect(llamadasDe(ctx, 'restore')).toHaveLength(1)

    // El primer fillRect cubre el lienzo entero (0,0,width,height).
    const rects = llamadasDe(ctx, 'fillRect')
    expect(rects[0].args).toEqual([0, 0, 1200, 630])
    expect(ctx.fillStyleSets[0]).toBe(TOP5_CANVAS_THEME.background)
  })

  it('dibuja las dos bandas del tajo diagonal y una hairline de oro', () => {
    const ctx = crearCtxStub()
    drawTop5Background(ctx as unknown as CanvasRenderingContext2D, {
      width: 1200,
      height: 630,
    })

    // Dos bandas (beginPath+closePath+fill cada una) + el lienzo de fondo.
    expect(llamadasDe(ctx, 'closePath')).toHaveLength(2)
    expect(llamadasDe(ctx, 'fill')).toHaveLength(2)
    // La hairline: un stroke con lineWidth 2 y color de oro semitransparente.
    expect(llamadasDe(ctx, 'stroke')).toHaveLength(1)
    expect(ctx.lineWidthSets).toContain(2)
    expect(ctx.strokeStyleSets).toContain(TOP5_CANVAS_THEME.goldHairline)

    // Las bandas usan los tokens de blade carmesí.
    expect(ctx.fillStyleSets).toContain(TOP5_CANVAS_THEME.bladeSoft)
    expect(ctx.fillStyleSets).toContain(TOP5_CANVAS_THEME.bladeStrong)
  })

  it('estampa el kanji 戦 en marca de agua alineado a la izquierda', () => {
    const ctx = crearCtxStub()
    drawTop5Background(ctx as unknown as CanvasRenderingContext2D, {
      width: 1200,
      height: 630,
    })

    const textos = llamadasDe(ctx, 'fillText')
    expect(textos).toHaveLength(1)
    expect(textos[0].args[0]).toBe('戦')
    expect(ctx.textAlignSets).toContain('left')
    expect(ctx.fillStyleSets).toContain(TOP5_CANVAS_THEME.kanjiWatermark)
    // La fuente usa el stack serif CJK de marca.
    expect(ctx.fontSets.some((f) => String(f).includes(KANJI_SERIF_STACK))).toBe(true)
  })

  it('escala las coordenadas con el width/height recibido', () => {
    const a = crearCtxStub()
    const b = crearCtxStub()
    drawTop5Background(a as unknown as CanvasRenderingContext2D, { width: 1200, height: 630 })
    drawTop5Background(b as unknown as CanvasRenderingContext2D, { width: 600, height: 315 })

    const rectA = llamadasDe(a, 'fillRect')[0].args
    const rectB = llamadasDe(b, 'fillRect')[0].args
    expect(rectA).toEqual([0, 0, 1200, 630])
    expect(rectB).toEqual([0, 0, 600, 315])
  })
})

describe('drawTop5Numeral — chip de rango con numeral kanji', () => {
  it('dibuja el chip circular (arc + fill + stroke) y lo balancea con save/restore', () => {
    const ctx = crearCtxStub()
    drawTop5Numeral(ctx as unknown as CanvasRenderingContext2D, 0, 100, 200)

    const nombres = nombresLlamados(ctx)
    expect(nombres[0]).toBe('save')
    expect(nombres[nombres.length - 1]).toBe('restore')

    const arcs = llamadasDe(ctx, 'arc')
    expect(arcs).toHaveLength(1)
    // arc(cx, cy, r=17, 0, 2π)
    expect(arcs[0].args[0]).toBe(100)
    expect(arcs[0].args[1]).toBe(200)
    expect(arcs[0].args[2]).toBe(17)
    expect(arcs[0].args[4]).toBeCloseTo(Math.PI * 2)

    expect(llamadasDe(ctx, 'fill')).toHaveLength(1)
    expect(llamadasDe(ctx, 'stroke')).toHaveLength(1)
    expect(ctx.fillStyleSets).toContain(TOP5_CANVAS_THEME.numeralChip)
    expect(ctx.strokeStyleSets).toContain(TOP5_CANVAS_THEME.numeralStroke)
  })

  it('pinta el numeral kanji correcto, centrado, en el centro del chip', () => {
    const ctx = crearCtxStub()
    drawTop5Numeral(ctx as unknown as CanvasRenderingContext2D, 2, 50, 80)

    const textos = llamadasDe(ctx, 'fillText')
    expect(textos).toHaveLength(1)
    // index 2 → '三'; centrado en (cx, cy+1).
    expect(textos[0].args).toEqual(['三', 50, 81])
    expect(ctx.textAlignSets).toContain('center')
    expect(ctx.textBaselineSets).toContain('middle')
    expect(ctx.fillStyleSets).toContain(TOP5_CANVAS_THEME.gold)
  })

  it('usa cada kanji de rango para los índices 0..4', () => {
    for (let i = 0; i < 5; i++) {
      const ctx = crearCtxStub()
      drawTop5Numeral(ctx as unknown as CanvasRenderingContext2D, i, 0, 0)
      expect(llamadasDe(ctx, 'fillText')[0].args[0]).toBe(KANJI_RANGO[i])
    }
  })

  it('cae al número 1-based cuando el índice queda fuera de rango', () => {
    const ctx = crearCtxStub()
    drawTop5Numeral(ctx as unknown as CanvasRenderingContext2D, 9, 0, 0)
    // KANJI_RANGO[9] es undefined → String(9 + 1) = '10'.
    expect(llamadasDe(ctx, 'fillText')[0].args[0]).toBe('10')
  })
})
