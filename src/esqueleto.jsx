// La portada prerenderizada: el HTML de la aplicación en «/» tal como lo
// pinta React antes de conocer al visitante (sin su colección, su día, su
// pantalla ni los filtros de la dirección; ver lib/hidratado). Lo inserta
// scripts/prerender.mjs en dist/index.html y main.jsx lo hidrata: la sala,
// el título y las acciones se pintan sin esperar al JavaScript, y React los
// reutiliza tal cual (no se vuelven a crear ni repiten su entrada).
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { App } from './App.jsx'

/** HTML de la portada para `base` (la carpeta de publicación, con barra final). */
export function esqueletoPortada(base = '/') {
  return renderToString(
    <StrictMode>
      <StaticRouter basename={base} location={base}>
        <App />
      </StaticRouter>
    </StrictMode>,
  )
}
