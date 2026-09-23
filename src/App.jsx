import { Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Cabecera } from './components/Cabecera.jsx'
import { Pie } from './components/Pie.jsx'
import { useNavegacionDelegada, useRestaurarScroll } from './lib/navegacion.js'
import Ficha from './pages/Ficha.jsx'
import Galeria from './pages/Galeria.jsx'
import NoEncontrada from './pages/NoEncontrada.jsx'
import { coleccion, sobres } from './paginas.js'

export function App() {
  useNavegacionDelegada()
  useRestaurarScroll()

  return (
    <>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <Cabecera />
      <main id="contenido" className="contenido" tabIndex={-1}>
        <Routes>
          <Route index element={<Galeria />} />
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
          <Route
            path="coleccion"
            element={
              <Suspense fallback={<div className="coleccion-cargando" />}>
                <coleccion.Componente />
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
