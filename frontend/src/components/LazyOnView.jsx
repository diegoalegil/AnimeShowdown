import { useEffect, useRef, useState } from 'react'

/**
 * Difiere el render real de `children` hasta que el placeholder entra (o
 * está a punto de entrar) en el viewport. Reserva `minHeight` para no
 * causar layout shift cuando el contenido aparece.
 *
 * la home montaba 9 secciones de golpe al primer
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

export default function LazyOnView({ minHeight = 600, rootMargin = '1600px 0px', children }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(!supportsIO)
  // rootMargin en deps causaba disconnect/recreate
  // del IntersectionObserver en cada render del padre si pasaban un
  // string literal (identidad nueva por render). Lo cacheamos en ref
  // y solo lo leemos al montar; cambios posteriores se ignoran (no
  // queremos re-observar tras la primera intersección de todas formas).
  const rootMarginRef = useRef(rootMargin)

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
      { rootMargin: rootMarginRef.current },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  if (visible) return <>{children}</>
  // content-visibility:auto + contain-intrinsic-size: el navegador no paga
  // layout/paint del placeholder mientras está lejos del viewport, pero reserva
  // su alto, así el scroll va más fluido y no aparece el hueco en blanco.
  const intrinsic = typeof minHeight === 'number' ? `${minHeight}px` : minHeight
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-lazy-on-view-placeholder="true"
      className="as-lazy-placeholder"
      style={{ minHeight, contentVisibility: 'auto', containIntrinsicSize: `auto ${intrinsic}` }}
    >
      <div className="as-lazy-placeholder__surface">
        <span className="as-lazy-placeholder__media" />
        <span className="as-lazy-placeholder__line as-lazy-placeholder__line--wide" />
        <span className="as-lazy-placeholder__line" />
      </div>
    </div>
  )
}
