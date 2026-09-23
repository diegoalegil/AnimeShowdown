import { describe, expect, it } from 'vitest'
import { vuelo } from './coreografia.js'

const caja = (left, top, width, height) => ({ left, top, width, height })

describe('vuelo', () => {
  it('lleva el centro de una caja al centro de otra', () => {
    expect(vuelo(caja(0, 0, 100, 150), caja(300, 50, 50, 75))).toEqual({ dx: 275, dy: 12.5 })
  })

  it('sin desplazamiento si las cajas comparten centro', () => {
    expect(vuelo(caja(0, 0, 100, 100), caja(40, 40, 20, 20))).toEqual({ dx: 0, dy: 0 })
  })
})
