import { lazy, Suspense, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

// Lazy: el modal arrastra el editor de avatar + catálogo + react-hook-form.
// Solo cargan cuando un usuario realmente necesita onboarding, así no pesa
// en el bundle inicial (presupuesto CI de 250KB gzip).
const OnboardingModal = lazy(() => import('./OnboardingModal'))

/**
 * V-8: monta el OnboardingModal cuando el usuario logueado tiene
 * needsOnboarding=true (cuenta OAuth recién creada). Side-effect-only desde
 * fuera; se monta global en App. Al saltar/finalizar, el backend marca el
 * paso como visto, needsOnboarding pasa a false y el modal no reaparece.
 */
function OnboardingGate() {
  const { user } = useAuth()
  const needs = Boolean(user?.needsOnboarding)

  // Patrón "ajustar estado en render" (no en efecto): abrimos cuando
  // needsOnboarding pasa a true (login OAuth recién resuelto). NO cerramos
  // automáticamente cuando vuelve a false — el paso de username marca el
  // onboarding como completado en mitad del flujo y queremos seguir hasta el
  // avatar. El cierre es siempre explícito (Saltar / Finalizar / backdrop).
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [open, setOpen] = useState(needs)
  const [prevNeeds, setPrevNeeds] = useState(needs)
  if (needs !== prevNeeds) {
    setPrevNeeds(needs)
    if (needs) setOpen(true)
  }

  if (!open) return null

  return (
    <Suspense fallback={null}>
      <OnboardingModal open={open} onClose={() => setOpen(false)} />
    </Suspense>
  )
}

export default OnboardingGate
