import { lazy, Suspense } from 'react'

/**
 * Partes de combate — DispatchToast (destino del alias de Vite `sonner`).
 *
 * Sustituye al <Toaster /> de sonner manteniendo la firma de las llamadas
 * existentes: toast.success/error/info(título, { description, duration,
 * action }) + el nuevo toast.achievement (sello 章, filo oro). Tira de papel
 * con sello hanko por tipo (成/否/報/章), cuerpo en UNA línea (description en
 * font-mono) y ttl visible como mecha. Pila máxima 3 + cola FIFO.
 *
 * Arquitectura en tres piezas (clave para el presupuesto de bundle):
 *  - dispatch-toast-store.js  → store + `toast` (JS puro, sin React/framer):
 *    lo importan los 65 call-sites, así que NO debe arrastrar framer.
 *  - DispatchToasterView.jsx  → viewport real (framer + drag + JSX), lazy.
 *  - este fichero             → re-exporta `toast`/`__timerCount` y monta el
 *    viewport con React.lazy. Así framer-motion no entra en el chunk eager
 *    `app-runtime` (regresión de ~32KB gzip evitada).
 *
 * Requiere en @theme: --ease-stamp: cubic-bezier(0.34, 1.56, 0.64, 1);
 */

// react-refresh/only-export-components: este fichero es el equivalente a
// sonner — store de módulo (toast) + componente (DispatchToaster) juntos a
// propósito, como hace la librería que sustituye. El núcleo del store ya vive
// en un .js puro; aquí solo se re-exporta `toast` para que el alias sonner
// resuelva sin tocar los 65 call-sites.
// eslint-disable-next-line react-refresh/only-export-components
export { toast, __timerCount } from './dispatch-toast-store'

/* ════════════════════════════════════════════════════════════════════
   Wrapper del viewport — lazy, para mantener framer fuera del path eager.
   El viewport real (framer + drag + JSX) vive en DispatchToasterView.jsx;
   aquí solo un wrapper con React.lazy. El toaster se monta una vez en
   App.jsx (drop-in del <Toaster /> de sonner, dentro de SoundProvider); las
   props (maxVisible/sound/className) pasan tal cual a la vista. El resto de
   props heredadas de sonner (position/theme/toastOptions...) las ignora la
   vista (solo desestructura las suyas) — el sello manda.
   ════════════════════════════════════════════════════════════════════ */

const DispatchToasterView = lazy(() => import('./DispatchToasterView'))

/**
 * Viewport de los Partes de combate (carga diferida del módulo con framer).
 *
 * @param {object} props
 * @param {number} [props.maxVisible=3] Pila máxima simultánea; el resto espera en cola FIFO.
 * @param {boolean} [props.sound=true] Golpe playAcunado al estampar (respeta el mute global vía SoundContext).
 * @param {string} [props.className] Clases extra para el viewport (p.ej. ajustar top).
 */
export function DispatchToaster(props) {
  return (
    <Suspense fallback={null}>
      <DispatchToasterView {...props} />
    </Suspense>
  )
}

/** Alias drop-in para el JSX existente de App.jsx. */
export { DispatchToaster as Toaster }
export default DispatchToaster
