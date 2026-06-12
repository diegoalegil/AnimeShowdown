import { Suspense, lazy, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getGate } from './tour-core'

const FirstDuelTour = lazy(() => import('./FirstDuelTour'))

/**
 * Decide si arranca el combate guiado y carga su chunk SOLO entonces —
 * para el 99% de visitas (gate cerrado o invitado) esto es un null que no
 * pesa nada. Candidato = usuario autenticado + gate ausente + primer
 * pisotón a /votar. El tour escribe el gate al salir; aquí solo se refleja.
 */
function FirstDuelTourGate() {
  const { user } = useAuth()
  const location = useLocation()
  const [gate, setGateState] = useState(() => getGate())
  const [montado, setMontado] = useState(false)

  // Ajuste durante el render (patrón React documentado): el tour se enciende
  // la primera vez que las tres condiciones coinciden, sin effects.
  if (!montado && gate == null && user && location.pathname === '/votar') {
    setMontado(true)
  }

  if (!montado) return null

  return (
    <Suspense fallback={null}>
      <FirstDuelTour
        onExit={(valor) => {
          setGateState(valor)
          setMontado(false)
        }}
      />
    </Suspense>
  )
}

export default FirstDuelTourGate
