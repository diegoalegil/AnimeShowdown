import { describe, expect, it } from 'vitest'
import { getArenaDescription, getArenaStatusLabel } from './arena-labels'

const luffy = { nombre: 'Monkey D. Luffy' }
const zoro = { nombre: 'Roronoa Zoro' }

const base = {
  modoBackend: false,
  exactDuelActive: false,
  identitiesHidden: false,
  fixedPersonaje: null,
  fixedRival: null,
  hasFixedAnime: false,
  fixedAnime: null,
  modoSugerido: false,
  dueloSugerido: null,
  votoInvitadoActivo: false,
  sinMatchesAbiertos: false,
}

describe('getArenaStatusLabel', () => {
  it('precedencia: backend > duelo fijado > reto > anime > sugerido > aleatorio', () => {
    expect(getArenaStatusLabel({ ...base, modoBackend: true })).toBe('Duelo en juego · En vivo')
    expect(getArenaStatusLabel({
      ...base, exactDuelActive: true, fixedPersonaje: luffy, fixedRival: zoro,
    })).toBe('Monkey D. Luffy vs Roronoa Zoro')
    expect(getArenaStatusLabel({ ...base, fixedPersonaje: luffy }))
      .toBe('Retando a Monkey D. Luffy')
    expect(getArenaStatusLabel({ ...base, hasFixedAnime: true, fixedAnime: 'One Piece' }))
      .toBe('Duelo interno · One Piece')
    expect(getArenaStatusLabel({ ...base, modoSugerido: true, dueloSugerido: { eloDiff: 12 } }))
      .toBe('Duelo ELO equilibrado · Δ 12')
    expect(getArenaStatusLabel(base)).toBe('Enfrentamiento aleatorio')
  })

  it('el modo a ciegas oculta identidades en los modos fijados', () => {
    expect(getArenaStatusLabel({
      ...base, exactDuelActive: true, identitiesHidden: true, fixedPersonaje: luffy, fixedRival: zoro,
    })).toBe('Duelo a ciegas')
    expect(getArenaStatusLabel({ ...base, fixedPersonaje: luffy, identitiesHidden: true }))
      .toBe('Reto a ciegas')
    expect(getArenaStatusLabel({
      ...base, hasFixedAnime: true, fixedAnime: 'One Piece', identitiesHidden: true,
    })).toBe('Duelo interno a ciegas')
  })
})

describe('getArenaDescription', () => {
  it('modo backend distingue invitado, a ciegas y normal', () => {
    expect(getArenaDescription({ ...base, modoBackend: true, votoInvitadoActivo: true }))
      .toContain('como invitado')
    expect(getArenaDescription({ ...base, modoBackend: true, identitiesHidden: true }))
      .toContain('a ciegas')
    expect(getArenaDescription({ ...base, modoBackend: true }))
      .toContain('bracket en directo')
  })

  it('sin matches abiertos explica el fallback de pares por ELO', () => {
    expect(getArenaDescription({ ...base, sinMatchesAbiertos: true }))
      .toBe('No hay torneos en juego — te proponemos pares de ELO similar')
  })

  it('duelo fijado menciona a ambos personajes', () => {
    expect(getArenaDescription({
      ...base, exactDuelActive: true, fixedPersonaje: luffy, fixedRival: zoro,
    })).toBe('Duelo fijado desde una comparación: Monkey D. Luffy vs Roronoa Zoro')
  })
})
