import { lazy, Suspense, useEffect, useState } from 'react'

// Wrapper que aplaza el mount real del CommandPalette hasta el primer
// intento de abrirlo (Cmd/Ctrl+K o Cmd/Ctrl+J). Audit (2026-05-17):
// CommandPalette se montaba globalmente desde App.jsx aunque estuviera
// cerrado, arrastrando cmdk, todo el catalogo personajes (730 entries)
// y un fetch de torneos al primer paint — coste innecesario para la
// mayoría de visitas que nunca lo abren.
//
// Tras primer key event: monta lazy. CommandPalette internamente abre
// su state al detectar la misma combinación (su useEffect propio sigue
// activo y dispara el open dentro del componente recién montado, en el
// mismo tick del browser).
const CommandPalette = lazy(() => import('./CommandPalette'))

export default function CommandPaletteLazyMount() {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (armed) return
    const onKey = (e) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && (e.key === 'k' || e.key === 'K' || e.key === 'j' || e.key === 'J')) {
        setArmed(true)
        // No previene default — el listener de CommandPalette agarra el
        // mismo evento tras el mount (los events de keydown se procesan
        // por orden de registro; los handlers nuevos no ven el evento
        // actual). Por eso simulamos un segundo dispatch tras el mount:
        // ver useEffect siguiente.
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed])

  useEffect(() => {
    if (!armed) return
    // Re-emite el evento Cmd+K tras un microtask para que el listener
    // recién montado dentro de CommandPalette lo capture y abra el
    // dialog. Sin esto, el primer Cmd+K queda "perdido" entre el mount
    // y el listener — el usuario tendría que pulsar Cmd+K dos veces.
    const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true })
    queueMicrotask(() => window.dispatchEvent(ev))
  }, [armed])

  if (!armed) return null
  return (
    <Suspense fallback={null}>
      <CommandPalette />
    </Suspense>
  )
}
