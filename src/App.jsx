import { Route, Routes } from 'react-router'
import { Cabecera } from './components/Cabecera.jsx'
import { Pie } from './components/Pie.jsx'
import { useNavegacionDelegada, useRestaurarScroll } from './lib/navegacion.js'
import Coleccion from './pages/Coleccion.jsx'
import Ficha from './pages/Ficha.jsx'
import Galeria from './pages/Galeria.jsx'
import NoEncontrada from './pages/NoEncontrada.jsx'
import Sobres from './pages/Sobres.jsx'

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
          <Route path="sobres" element={<Sobres />} />
          <Route path="coleccion" element={<Coleccion />} />
          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </main>
      <Pie />
    </>
  )
}
