import { useEffect, useRef, useState } from 'react'

/**
 * Difiere el render real de `children` hasta que el placeholder entra (o
 * está a punto de entrar) en el viewport. Reserva `minHeight` para no
 * causar layout shift cuando el contenido aparece.
 *
 * Audit (2026-05-17): la home montaba 9 secciones de golpe al primer
 * paint (~7.836 nodos DOM, 221 imágenes). Wrappeando las secciones
 * below-the-fold reducimos el initial DOM a ~30% sin tocar la
 * estructura de cada sección. Una vez visible, se mantiene montado
 * para no re-costear en scroll back-and-forth.
 */
// Initial state: si no hay IntersectionObserver (server-side / browser
// muy viejo), arrancamos visible=true para no perder el contenido.
// Esto evita un setState dentro del useEffect (linter
// react-hooks/set-state-in-effect).
const supportsIO = typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined'

export default function LazyOnView({ minHeight = 600, rootMargin = '400px', children }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(!supportsIO)

  useEffect(() => {
    if (visible || !supportsIO) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible, rootMargin])

  if (visible) return <>{children}</>
  return <div ref={ref} aria-hidden="true" style={{ minHeight }} />
}
