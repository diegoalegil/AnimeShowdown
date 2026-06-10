import { useEffect, useRef, useState } from 'react'

const STORAGE_FAST = 'animeshowdown.votar.fast'
const STORAGE_BLIND = 'animeshowdown.votar.blind'

/**
 * Preferencias persistidas de la arena de votar.
 *
 * Modo rápido (auto-next) por default — opt-out vía toggle. Antes era opt-in
 * y la gente tenía que pulsar "Siguiente duelo" tras cada voto: un click
 * extra por enfrentamiento que rompía el ritmo. Solo se respeta el valor de
 * localStorage si fue setado explícitamente a "false"; cualquier otro estado
 * (incluido no haber preferencia) = true.
 *
 * Expone fastModeRef sincronizada para que los handlers de voto puedan leer
 * el modo sin regenerarse en cada toggle.
 */
export function useVotarPreferences() {
  const [fastMode, setFastMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_FAST) !== 'false'
    } catch {
      return true
    }
  })
  const [blindMode, setBlindMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_BLIND) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FAST, String(fastMode))
    } catch {
      // ignore
    }
  }, [fastMode])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BLIND, String(blindMode))
    } catch {
      // ignore
    }
  }, [blindMode])

  const fastModeRef = useRef(fastMode)
  useEffect(() => {
    fastModeRef.current = fastMode
  }, [fastMode])

  return { fastMode, setFastMode, fastModeRef, blindMode, setBlindMode }
}
