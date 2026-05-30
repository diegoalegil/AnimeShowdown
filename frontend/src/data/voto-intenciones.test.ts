import { describe, it, expect } from 'vitest'

import { INTENCIONES, INTENCIONES_BY_ID, labelIntencion } from './voto-intenciones.js'

// Contrato de wire en lockstep con el enum backend CategoriaVoto.java. Si esta
// lista cambia, hay que tocar TAMBIÉN el enum (la categoría no se valida en
// DDL, así que no hay migración que lo recuerde). Este test es el guard de
// drift: si los ids divergen, falla y obliga a revisar ambos lados.
const IDS_BACKEND = [
  'poder',
  'diseno',
  'carisma',
  'mejor-escrito',
  'mejor-villano',
  'favorito',
]

describe('voto-intenciones (catálogo de intención de voto)', () => {
  it('mantiene los 6 ids de wire en lockstep con CategoriaVoto.java', () => {
    expect(INTENCIONES.map((i) => i.id)).toEqual(IDS_BACKEND)
  })

  it('cada intención tiene label, emoji y tono', () => {
    for (const intencion of INTENCIONES) {
      expect(intencion.label).toBeTruthy()
      expect(intencion.emoji).toBeTruthy()
      expect(intencion.tono).toBeTruthy()
    }
  })

  it('INTENCIONES_BY_ID indexa por id de wire', () => {
    expect(INTENCIONES_BY_ID['mejor-villano'].label).toBe('Mejor villano')
    expect(INTENCIONES_BY_ID.poder.emoji).toBeTruthy()
    expect(INTENCIONES_BY_ID['no-existe']).toBeUndefined()
  })

  it('labelIntencion devuelve el label, con fallback al propio id', () => {
    expect(labelIntencion('poder')).toBe('Poder')
    expect(labelIntencion('no-existe')).toBe('no-existe')
  })
})
