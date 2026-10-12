import { describe, expect, it } from 'vitest'
import { crearAzar } from '../comun/azar.js'
import { PERSONAJES } from '../comun/cartas.js'
import { guardarEstado, leerEstado } from './almacen.js'
import {
  CLAVE_ALMACEN,
  PESO_TOTAL,
  SUERTES,
  VARILLAS,
  elegirSuerte,
  esSal,
  fortunaDelDia,
  nuevaSal,
  porcentaje,
  textoCompartir,
} from './reglas.js'

describe('SUERTES', () => {
  it('son cinco, en orden tradicional, y los pesos suman 100', () => {
    expect(SUERTES.map((s) => s.kanji)).toEqual(['大吉', '中吉', '小吉', '末吉', '凶'])
    expect(PESO_TOTAL).toBe(100)
    expect(SUERTES.map(porcentaje)).toEqual([31, 17, 18, 17, 17])
  })

  it('cada suerte tiene texto y al menos un consejo', () => {
    for (const s of SUERTES) {
      expect(s.texto.length).toBeGreaterThan(10)
      expect(s.consejos.length).toBeGreaterThan(0)
    }
  })
})

describe('elegirSuerte', () => {
  it('recorre el acumulado en orden: 0 → 大吉, 0,31 → 中吉, 0,999 → 凶', () => {
    expect(elegirSuerte(() => 0).kanji).toBe('大吉')
    expect(elegirSuerte(() => 0.3099).kanji).toBe('大吉')
    expect(elegirSuerte(() => 0.31).kanji).toBe('中吉')
    expect(elegirSuerte(() => 0.48).kanji).toBe('小吉')
    expect(elegirSuerte(() => 0.66).kanji).toBe('末吉')
    expect(elegirSuerte(() => 0.83).kanji).toBe('凶')
    expect(elegirSuerte(() => 0.9999).kanji).toBe('凶')
  })

  it('con el generador en el límite (1) no se sale de la lista', () => {
    expect(elegirSuerte(() => 1).kanji).toBe('凶')
  })

  it('con semilla reparte aproximadamente según los pesos', () => {
    const rng = crearAzar(2026)
    const cuenta = Object.fromEntries(SUERTES.map((s) => [s.clave, 0]))
    const N = 20000
    for (let i = 0; i < N; i++) cuenta[elegirSuerte(rng).clave]++
    for (const s of SUERTES) {
      const real = (cuenta[s.clave] / N) * 100
      expect(Math.abs(real - s.peso)).toBeLessThan(1.5)
    }
  })
})

describe('fortunaDelDia', () => {
  it('es determinista para el mismo día y la misma sal', () => {
    const a = fortunaDelDia('2026-10-12', 12345)
    const b = fortunaDelDia('2026-10-12', 12345)
    expect(a.suerte).toBe(b.suerte)
    expect(a.numero).toBe(b.numero)
    expect(a.consejo).toBe(b.consejo)
    expect(a.guardian.id).toBe(b.guardian.id)
  })

  it('cambia con la sal (dos navegadores no ven lo mismo) y con el día', () => {
    const base = fortunaDelDia('2026-10-12', 1)
    const distintas = new Set()
    for (let sal = 2; sal < 40; sal++) distintas.add(fortunaDelDia('2026-10-12', sal).numero)
    expect(distintas.size).toBeGreaterThan(10)
    const dias = new Set()
    for (let d = 1; d <= 28; d++) dias.add(fortunaDelDia(`2026-10-${String(d).padStart(2, '0')}`, 1).guardian.id)
    expect(dias.size).toBeGreaterThan(10)
    expect(base.dia).toBe('2026-10-12')
  })

  it('la varilla va de 1 a 100, el consejo es de su suerte y el guardián es un personaje del catálogo', () => {
    const ids = new Set(PERSONAJES.map((c) => c.id))
    for (let sal = 0; sal < 300; sal++) {
      const f = fortunaDelDia('2026-01-01', sal)
      expect(f.numero).toBeGreaterThanOrEqual(1)
      expect(f.numero).toBeLessThanOrEqual(VARILLAS)
      expect(f.suerte.consejos).toContain(f.consejo)
      expect(ids.has(f.guardian.id)).toBe(true)
    }
  })

  it('a lo largo de muchas sales salen las cinco suertes', () => {
    const vistas = new Set()
    for (let sal = 0; sal < 200; sal++) vistas.add(fortunaDelDia('2026-05-05', sal).suerte.clave)
    expect(vistas.size).toBe(5)
  })
})

describe('nuevaSal y textoCompartir', () => {
  it('la sal es un entero no negativo de 31 bits', () => {
    const sal = nuevaSal(crearAzar(9))
    expect(esSal(sal)).toBe(true)
    expect(sal).toBeLessThan(0x80000000)
    expect(esSal(-1)).toBe(false)
    expect(esSal(1.5)).toBe(false)
    expect(esSal('7')).toBe(false)
  })

  it('el texto compartible lleva el día, el kanji, el número y el guardián', () => {
    const f = fortunaDelDia('2026-10-12', 3)
    const texto = textoCompartir(f)
    expect(texto).toContain('2026-10-12')
    expect(texto).toContain(f.suerte.kanji)
    expect(texto).toContain(`第 ${f.numero} 番`)
    expect(texto).toContain(f.guardian.nombre)
  })
})

/** Un localStorage de juguete para los tests. */
function almacenFalso(inicial = {}) {
  const datos = { ...inicial }
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => {
      datos[k] = String(v)
    },
    datos,
  }
}

describe('almacen', () => {
  it('sin nada guardado crea una sal y la deja escrita; revelado es null', () => {
    const almacen = almacenFalso()
    const estado = leerEstado(almacen, crearAzar(1))
    expect(esSal(estado.sal)).toBe(true)
    expect(estado.revelado).toBeNull()
    expect(JSON.parse(almacen.datos[CLAVE_ALMACEN]).sal).toBe(estado.sal)
  })

  it('conserva la sal entre lecturas y recuerda el día revelado', () => {
    const almacen = almacenFalso()
    const primero = leerEstado(almacen, crearAzar(5))
    guardarEstado({ ...primero, revelado: '2026-10-12' }, almacen)
    const segundo = leerEstado(almacen, crearAzar(99))
    expect(segundo.sal).toBe(primero.sal)
    expect(segundo.revelado).toBe('2026-10-12')
  })

  it('sanea basura: JSON roto, tipos raros y fechas inválidas', () => {
    expect(leerEstado(almacenFalso({ [CLAVE_ALMACEN]: '{no json' }), crearAzar(2)).revelado).toBeNull()
    const raro = leerEstado(
      almacenFalso({ [CLAVE_ALMACEN]: JSON.stringify({ sal: 'x', revelado: 'ayer' }) }),
      crearAzar(2),
    )
    expect(esSal(raro.sal)).toBe(true)
    expect(raro.revelado).toBeNull()
    expect(leerEstado(almacenFalso({ [CLAVE_ALMACEN]: '[1,2]' }), crearAzar(2)).revelado).toBeNull()
  })

  it('sin almacén (disco roto) sigue devolviendo un estado usable', () => {
    const roto = {
      getItem: () => {
        throw new Error('sin disco')
      },
      setItem: () => {
        throw new Error('sin disco')
      },
    }
    const estado = leerEstado(roto, crearAzar(3))
    expect(esSal(estado.sal)).toBe(true)
    expect(() => guardarEstado(estado, roto)).not.toThrow()
    expect(leerEstado(undefined, crearAzar(3)).revelado).toBeNull()
  })
})
