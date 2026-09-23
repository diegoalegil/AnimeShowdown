import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App.jsx'
import { cuandoLibre } from './lib/diferido.js'
import { vigilarImagenes } from './lib/images.js'
import { precargarPaginas } from './paginas.js'
import './index.css'

// Antes de pintar: así ninguna imagen carga sin que se marque.
vigilarImagenes(document)

// basename con la barra final ("/AnimeShowdown/"): así la portada con filtros
// es "/AnimeShowdown/?q=…", la carpeta que sirve GitHub Pages, y no
// "/AnimeShowdown?q=…".
// useTransitions={false}: la navegación se aplica de forma síncrona, que es lo
// que necesita document.startViewTransition para capturar el estado nuevo.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL} useTransitions={false}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

import('./fuentes-jp.css')
cuandoLibre(precargarPaginas)
