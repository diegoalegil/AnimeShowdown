import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
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
const raiz = document.getElementById('root')
const aplicacion = (
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL} useTransitions={false}>
      <App />
    </BrowserRouter>
  </StrictMode>
)
// La portada llega ya pintada (ver scripts/prerender.mjs): React la hidrata y
// reutiliza su HTML. Las demás páginas llegan vacías y se pintan aquí.
if (raiz.firstElementChild) hydrateRoot(raiz, aplicacion)
else createRoot(raiz).render(aplicacion)

import('./fuentes-jp.css')
// Las otras páginas se precargan cuando la portada ya ha cargado del todo y
// el navegador está libre: no compiten con la sala ni con las primeras cartas.
if (document.readyState === 'complete') cuandoLibre(precargarPaginas)
else window.addEventListener('load', () => cuandoLibre(precargarPaginas), { once: true })
