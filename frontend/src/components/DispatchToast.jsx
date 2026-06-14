import { lazy, Suspense, useSyncExternalStore } from 'react'
import { subscribe, getSnapshot } from './dispatch-toast-store'

/**
 * Partes de combate — DispatchToast (destino del alias de Vite `sonner`).
 *
 * Sustituye al <Toaster /> de sonner manteniendo la firma de las llamadas
 * existentes: toast.success/error/info/message(título, { description, duration,
 * action }) + el nuevo toast.achievement (sello 章, filo oro). Tira de papel
 * con sello hanko por tipo (成/否/報/章), cuerpo en UNA línea (description en
 * font-mono) y ttl visible como mecha. Pila máxima 3 + cola FIFO.
 *
 * Arquitectura en piezas (clave para el presupuesto de bundle Y la a11y):
 *  - dispatch-toast-store.js  → store + `toast` (JS puro, sin React/framer):
 *    lo importan los 65 call-sites, así que NO debe arrastrar framer.
 *  - DispatchLiveRegions (aquí) → las dos regiones aria-live, EAGER y
 *    persistentes desde el primer render (un lector de pantalla debe poder
 *    registrarlas antes de cualquier toast; no pueden vivir en la vista lazy).
 *    No importa framer: se queda en el chunk eager sin coste real.
 *  - DispatchToasterView.jsx  → viewport visual (framer + drag + JSX), lazy.
 *  - este fichero             → re-exporta `toast`/`__timerCount`, monta las
 *    regiones eager y el viewport con React.lazy (framer fuera del eager).
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

// El zero-width space alterna el contenido para forzar el re-anuncio cuando el
// texto se repite; cada región usa SU PROPIO seq para no mutar a la otra.
const pad = (txt, seq) => (seq % 2 === 1 ? txt + String.fromCharCode(0x200B) : txt)

/**
 * Las dos regiones aria-live, persistentes (EAGER). Suscritas al store por
 * useSyncExternalStore; sr-only (utilidad de Tailwind, no depende del CSS de
 * la vista lazy). polite: success/info/achievement; assertive: SOLO errores.
 * El aria-label "Notificaciones de AnimeShowdown" preserva el de sonner.
 */
function DispatchLiveRegions() {
  const { announce } = useSyncExternalStore(subscribe, getSnapshot)
  return (
    <>
      {/* role status/alert: roles de live-region que SÍ admiten aria-label
          (un div con aria-label y sin rol dispara axe aria-prohibited-attr). */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-label="Notificaciones de AnimeShowdown"
      >
        {pad(announce.polite, announce.politeSeq)}
      </div>
      <div
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-label="Alertas de AnimeShowdown"
      >
        {pad(announce.assertive, announce.assertiveSeq)}
      </div>
    </>
  )
}

const DispatchToasterView = lazy(() => import('./DispatchToasterView'))

/**
 * Viewport de los Partes de combate. Las regiones aria-live van EAGER; solo el
 * stack visual (con framer) se difiere. Se monta una vez en App.jsx (drop-in
 * del <Toaster /> de sonner, dentro de SoundProvider); las props
 * (maxVisible/sound/className) pasan a la vista. El resto de props heredadas de
 * sonner (position/theme/toastOptions...) las ignora la vista — el sello manda.
 *
 * @param {object} props
 * @param {number} [props.maxVisible=3] Pila máxima simultánea; el resto espera en cola FIFO.
 * @param {boolean} [props.sound=true] Golpe playAcunado al estampar (respeta el mute global vía SoundContext).
 * @param {string} [props.className] Clases extra para el viewport (p.ej. ajustar top).
 */
export function DispatchToaster(props) {
  return (
    <>
      <DispatchLiveRegions />
      <Suspense fallback={null}>
        <DispatchToasterView {...props} />
      </Suspense>
    </>
  )
}

/** Alias drop-in para el JSX existente de App.jsx. */
export { DispatchToaster as Toaster }
export default DispatchToaster
