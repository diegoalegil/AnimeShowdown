import { lazy, Suspense, useEffect, useState } from 'react'

// Wrapper que aplaza el mount real del CommandPalette hasta el primer
// intento de abrirlo (Cmd/Ctrl+K o Cmd/Ctrl+J). Montarlo globalmente
// desde App.jsx arrastra cmdk, el catálogo de personajes y un fetch de
// torneos al primer paint, coste innecesario para la mayoría de visitas.
//
// Tras primer key event: monta lazy con prop initialOpen={true} para
// abrir el dialog inmediatamente sin depender de re-dispatch del
// KeyboardEvent (que podía tragarse en redes lentas porque el listener
// interno aún no estaba registrado cuando se re-emitía).
//
// También escucha el evento personalizado "animeshowdown:open-command-palette"
// para que el botón lupa del Header pueda activarlo sin depender de teclado.
const CommandPalette = lazy(() => import('./CommandPalette'))

export const OPEN_COMMAND_PALETTE_EVENT = 'animeshowdown:open-command-palette'

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
    const onOpen = () => setArmed(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    }
  }, [armed])

  if (!armed) return null
  return (
    <Suspense fallback={null}>
      <CommandPalette initialOpen />
    </Suspense>
  )
}
