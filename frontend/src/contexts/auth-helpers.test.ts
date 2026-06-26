import { describe, expect, it } from 'vitest'
import { ApiError } from '../lib/api'
import { buildLocalUser, describeError } from './auth-helpers'

describe('buildLocalUser', () => {
  it('devuelve null sin payload', () => {
    expect(buildLocalUser(null)).toBeNull()
    expect(buildLocalUser(undefined)).toBeNull()
  })

  it('aplica defaults seguros (guarda los bugs reales del banner de verificación y la card 2FA)', () => {
    const u = buildLocalUser({ id: 1, username: 'ada', email: 'a@e.com' })
    expect(u).toMatchObject({
      id: 1,
      username: 'ada',
      email: 'a@e.com',
      rol: 'USER',
      estadoVerificacion: 'PENDIENTE',
      totpHabilitado: false,
      needsOnboarding: false,
      bio: null,
      marcoAvatar: null,
    })
  })

  it('respeta los valores presentes en el payload', () => {
    const u = buildLocalUser({
      id: 2,
      username: 'neo',
      email: 'n@e.com',
      rol: 'ADMIN',
      estadoVerificacion: 'ACTIVO',
      totpHabilitado: true,
      needsOnboarding: true,
      bio: 'hola',
      marcoAvatar: 'oro',
    })
    expect(u).toMatchObject({
      rol: 'ADMIN',
      estadoVerificacion: 'ACTIVO',
      totpHabilitado: true,
      needsOnboarding: true,
      bio: 'hola',
      marcoAvatar: 'oro',
    })
  })

  it('totpHabilitado y needsOnboarding solo son true con === true (no truthy)', () => {
    const u = buildLocalUser({ id: 3, username: 'x', totpHabilitado: 'yes', needsOnboarding: 1 })
    expect(u.totpHabilitado).toBe(false)
    expect(u.needsOnboarding).toBe(false)
  })
})

describe('describeError', () => {
  const err = (status: number, message = 'Boom') => new ApiError(message, status, null)

  it('401 -> credenciales inválidas', () => {
    expect(describeError(err(401)).title).toBe('Credenciales inválidas')
  })

  it('409 -> usuario o email ya registrado', () => {
    expect(describeError(err(409)).title).toBe('Usuario o email ya registrado')
  })

  it('otros 4xx -> datos inválidos, usando el message del servidor', () => {
    const d = describeError(err(422, 'Email feo'))
    expect(d.title).toBe('Datos inválidos')
    expect(d.description).toBe('Email feo')
  })

  it('5xx -> error de servidor e incluye el status', () => {
    expect(describeError(err(503)).description).toContain('503')
  })

  it('error que no es ApiError (red caída) -> no se pudo conectar', () => {
    expect(describeError(new Error('network down')).title).toBe('No se pudo conectar al servidor')
  })
})
