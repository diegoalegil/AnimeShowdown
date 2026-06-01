import { describe, it, expectTypeOf } from 'vitest'

import type { LocalVote, Nullable, PersonajeLite, ShareResult } from './types'

// Smoke test de tipos: confirma que el módulo exporta los aliases públicos
// y que la infraestructura Vitest está conectada.
//
// expectTypeOf falla en tiempo de typecheck si una de las shapes deja de
// existir. NO valida valores runtime — para eso ya están los tests de
// los consumidores productivos.

describe('lib/types — public type contract', () => {
  it('Nullable<T> admite valor o null', () => {
    expectTypeOf<Nullable<string>>().toEqualTypeOf<string | null>()
  })

  it('PersonajeLite expone slug y nombre obligatorios', () => {
    expectTypeOf<PersonajeLite>().toHaveProperty('slug').toEqualTypeOf<string>()
    expectTypeOf<PersonajeLite>().toHaveProperty('nombre').toEqualTypeOf<string>()
  })

  it('LocalVote modela un voto local con timestamps y participantes', () => {
    expectTypeOf<LocalVote>().toHaveProperty('id').toEqualTypeOf<string>()
    expectTypeOf<LocalVote>().toHaveProperty('ganadorSlug').toEqualTypeOf<string>()
    expectTypeOf<LocalVote>().toHaveProperty('perdedorSlug').toEqualTypeOf<string>()
  })

  it('ShareResult es una unión cerrada de los outcomes esperados', () => {
    expectTypeOf<ShareResult>().toEqualTypeOf<'native' | 'clipboard' | 'cancelled'>()
  })
})
