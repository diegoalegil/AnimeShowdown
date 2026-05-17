import { lazy, Suspense, useEffect, useState } from 'react'

// Wrapper que aplaza el mount real del CommandPalette hasta el primer
// intento de abrirlo (Cmd/Ctrl+K o Cmd/Ctrl+J). Audit (2026-05-17):
// CommandPalette se montaba globalmente desde App.jsx aunque estuviera
// cerrado, arrastrando cmdk, todo el catalogo personajes (730 entries)
// y un fetch de torneos al primer paint — coste innecesario para la
// mayoría de visitas que nunca lo abren.
//
// Tras primer key event: monta lazy con prop initialOpen={true} para
// abrir el dialog inmediatamente sin depender de re-dispatch del
// KeyboardEvent (que podía tragarse en redes lentas porque el listener
// interno aún no estaba registrado cuando se re-emitía).
const CommandPalette = lazy(() => import('./CommandPalette'))

export default function CommandPaletteLazyMount() {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (armed) return
    const onKey = (e) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && (e.key === 'k' || e.key === 'K' || e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        setArmed(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed])

  if (!armed) return null
  return (
    <Suspense fallback={null}>
      <CommandPalette initialOpen />
    </Suspense>
  )
}
