import { describe, expect, it } from 'vitest'
import { ordenLejanos } from './aplazar.js'

describe('ordenLejanos', () => {
  it('deja fuera los grupos cercanos y ordena el resto por cercanía', () => {
    expect(ordenLejanos(10, 5, 1)).toEqual([3, 7, 2, 8, 1, 9, 0])
    expect(ordenLejanos(4, 0, 1)).toEqual([2, 3])
    expect(ordenLejanos(3, 1, 3)).toEqual([])
  })
})
