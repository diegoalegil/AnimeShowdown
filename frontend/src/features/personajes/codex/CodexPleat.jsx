import { forwardRef } from 'react'
import './codex.css'

/**
 * CodexBookmark — un marcapáginas de tela (tab real del tablist).
 *
 * Es un `role="tab"` con `aria-selected` y roving tabindex; va dentro del
 * `role="tablist"` que monta FighterCodex. En desktop son pestañas verticales
 * a un lado (kanji + etiqueta); en 390px el contenedor las vuelve horizontales
 * arriba del pliego (solo kanji). Componente auxiliar a nivel de módulo.
 *
 * @param {object} props
 * @param {string} props.id        id del tab (`aria-controls` apunta al panel).
 * @param {string} [props.controls]  id del tabpanel asociado. Solo el tab
 *   seleccionado lo pasa (su panel es el único renderizado, patrón APG); en los
 *   inactivos es `undefined` y React omite el atributo `aria-controls`.
 * @param {string} props.kanji     Glifo del marcapáginas (戦 / 史 / 対 / 炎).
 * @param {string} props.title     Etiqueta de texto (oculta en 390px).
 * @param {boolean} props.selected
 * @param {number} props.enterIndex  Posición para el stagger de entrada.
 * @param {boolean} props.compact   Modo 390px (oculta la etiqueta).
 * @param {(e:React.KeyboardEvent)=>void} props.onKeyDown  Navegación por flechas.
 * @param {()=>void} props.onSelect
 */
export const CodexBookmark = forwardRef(function CodexBookmark(
  { id, controls, kanji, title, selected, enterIndex = 0, compact = false, onKeyDown, onSelect },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      title={title}
      className={`codex__bookmark min-h-[44px] sm:min-h-[64px] ${
        compact
          ? 'flex-1 justify-center rounded-t-lg px-3.5'
          : 'w-full rounded-r-lg px-3.5'
      }`}
      style={{ '--codex-bm-delay': `${enterIndex * 60}ms` }}
    >
      <span className="font-kanji-serif text-lg font-bold leading-none">{kanji}</span>
      {!compact && <span className="whitespace-nowrap text-[13px] font-semibold">{title}</span>}
    </button>
  )
})

/**
 * CodexPleat — pliego genérico: la cáscara animada de un `role="tabpanel"`.
 *
 * <p>FighterCodex monta UNA instancia (el escenario) y le pasa el contenido del
 * pliego activo; al cambiar de pliego, escribe `data-phase="closing"` y, tras
 * 300ms, `"opening"` con el `transform-origin` correcto (lo orquesta el padre
 * vía ref para no re-renderizar a 60fps). El alto está reservado por el
 * escenario → cambiar de pliego NUNCA produce scroll-jump ni CLS.
 *
 * @param {object} props
 * @param {string} props.id          id del panel (`aria-labelledby` = tab).
 * @param {string} props.labelledBy  id del tab que lo etiqueta.
 * @param {React.ReactNode} props.children  Contenido del pliego activo.
 * @param {React.Ref<HTMLDivElement>} ref  El padre anima/forza foco aquí.
 */
const CodexPleat = forwardRef(function CodexPleat({ id, labelledBy, children }, ref) {
  return (
    <div
      ref={ref}
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className="codex__panel absolute inset-0 focus:outline-none"
    >
      <div className="absolute inset-0 overflow-auto p-[clamp(18px,3vw,30px)]">{children}</div>
    </div>
  )
})

export default CodexPleat
