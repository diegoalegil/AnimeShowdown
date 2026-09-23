import { Suspense, useLayoutEffect, useRef } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { Cabecera } from './components/Cabecera.jsx'
import { Pie } from './components/Pie.jsx'
import { aplazarLejanos } from './lib/aplazar.js'
import { idsAncla, useNavegacionDelegada, useRestaurarScroll } from './lib/navegacion.js'
import { PaginaActiva } from './lib/paginaActiva.js'
import Ficha from './pages/Ficha.jsx'
import Galeria from './pages/Galeria.jsx'
import NoEncontrada from './pages/NoEncontrada.jsx'
import { coleccion, sobres } from './paginas.js'

export function App() {
  useNavegacionDelegada()
  useRestaurarScroll()
  const { pathname, state } = useLocation()
  // GitHub Pages sirve cada sección como carpeta: «/coleccion/» es «/coleccion».
  const ruta = pathname.replace(/(.)\/+$/, '$1')
  // Página de cartas desde la que se abrió la ficha que se ve (ver
  // navegacion.estadoPara). Sigue montada y oculta: ir a la ficha y volver
  // no desmonta ni vuelve a montar sus mil cartas, y al volver conserva su
  // scroll exacto.
  const origen = ruta.startsWith('/carta/') ? state?.volver : undefined

  return (
    <>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <Cabecera />
      <main id="contenido" className="contenido" tabIndex={-1}>
        {(ruta === '/' || origen === '/') && (
          <Pagina activa={ruta === '/'}>
            <Galeria />
          </Pagina>
        )}
        {(ruta === '/coleccion' || origen === '/coleccion') && (
          <Pagina activa={ruta === '/coleccion'}>
            <Suspense fallback={<div className="coleccion-cargando" />}>
              <coleccion.Componente />
            </Suspense>
          </Pagina>
        )}
        <Routes>
          {/* La galería y la colección se pintan arriba, fuera de las rutas. */}
          <Route index element={null} />
          <Route path="coleccion" element={null} />
          <Route path="carta/:id" element={<Ficha />} />
          <Route
            path="sobres"
            element={
              // Mientras llega el código (solo si se entra directamente), el escenario ya oscuro.
              <Suspense fallback={<div className="yoru escenario" />}>
                <sobres.Componente />
              </Suspense>
            }
          />
          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </main>
      <Pie />
    </>
  )
}

/**
 * Contenedor de una página que puede quedar oculta sin desmontarse (con
 * display: none; inert la saca además del foco y de los lectores de
 * pantalla). Al volver a mostrarse, los grupos de cartas lejanos a la carta
 * de destino esperan a que acabe la transición (ver lib/aplazar).
 */
function Pagina({ activa, children }) {
  const ref = useRef(null)
  const estuvoOculta = useRef(false)

  // Antes que el layout effect de App que coloca el scroll: así ningún
  // cálculo de estilo pasa todavía por los grupos lejanos.
  useLayoutEffect(() => {
    if (!activa) {
      estuvoOculta.current = true
      return undefined
    }
    if (!estuvoOculta.current) return undefined
    estuvoOculta.current = false
    return aplazarLejanos(ref.current, idsAncla())
  }, [activa])

  return (
    <PaginaActiva value={activa}>
      <div ref={ref} className="pagina" hidden={!activa} inert={!activa}>
        {children}
      </div>
    </PaginaActiva>
  )
}
