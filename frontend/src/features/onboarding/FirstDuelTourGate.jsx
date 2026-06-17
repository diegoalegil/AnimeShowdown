import { Suspense, lazy, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePersonajesCatalogo } from '../../hooks/usePersonajesCatalogo'
import { getGate, setGate } from './tour-core'

// El KUMITE DE INICIACIÓN (pieza 122) sustituye al antiguo tour de spotlight: su
// chunk (orquestador + 4 ejercicios + ceremonia) carga SOLO cuando arranca.
const TrainingKumite = lazy(() => import('./kumite/TrainingKumite'))

/**
 * Decide si arranca el kumite de iniciación y carga su chunk SOLO entonces —
 * para el 99% de visitas (gate cerrado o invitado) esto es un null que no pesa.
 * Candidato = usuario autenticado + gate ausente + primer pisotón a /votar, y
 * con el catálogo ya cargado (≥3 personajes para la maqueta de práctica).
 *
 * <p>El kumite NO escribe el gate (su persistencia es del padre): aquí lo
 * escribimos al completar ('done') o saltar ('skipped'), conservando la MISMA
 * clave de localStorage del onboarding existente (GATE_KEY en tour-core).
 */
function FirstDuelTourGate() {
  const { user } = useAuth()
  const location = useLocation()
  const { personajes } = usePersonajesCatalogo()
  const [gate, setGateState] = useState(() => getGate())
  const [montado, setMontado] = useState(false)

  const hayPracticantes = personajes.length >= 3

  // Ajuste durante el render (patrón React documentado): el kumite se enciende
  // la primera vez que las condiciones coinciden, sin effects.
  if (!montado && gate == null && user && location.pathname === '/votar' && hayPracticantes) {
    setMontado(true)
  }

  if (!montado) return null

  // Tres personajes de práctica deterministas del catálogo REAL (los más
  // rankeados): dos para el duelo (ej.1-2) y uno como objetivo de búsqueda (ej.3).
  const [izquierda, derecha, objetivo] = personajes

  const cerrar = (valor) => {
    setGate(valor)
    setGateState(valor)
    setMontado(false)
  }

  return (
    <Suspense fallback={null}>
      <TrainingKumite
        izquierda={izquierda}
        derecha={derecha}
        objetivo={objetivo}
        onComplete={() => cerrar('done')}
        onSkip={() => cerrar('skipped')}
      />
    </Suspense>
  )
}

export default FirstDuelTourGate
