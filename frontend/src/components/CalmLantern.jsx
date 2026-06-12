import { Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCalmMode } from '../hooks/useCalmMode'
import { useSound } from '../contexts/SoundContext'

/**
 * CalmLantern — la linterna del dojo. Toggle de modo calma del header,
 * colocado junto al de sonido (mismo estilo de botón utility h-10 w-10).
 *
 * La micro-interacción ES el mensaje: la llama (oro, trazo) se encoge a
 * brasa (carmesí, rellena) con cross-fade scale+opacity en 300ms y
 * --ease-brush; el header se atenúa un instante como confirmación
 * (html[data-calm-pulse], lo dispara useCalmMode). Dos capas
 * pre-renderizadas, solo transform/opacity — cero blur, cero loops:
 * la brasa es estática porque ES calma.
 *
 * Si el SO ya pide reduced-motion, la linterna aparece en brasa con
 * tooltip explicativo y el click no cambia nada (anuncia el porqué).
 *
 * Colocación en Header.jsx (nav desktop Y panel móvil, igual que el
 * toggle de sonido):
 *
 *   <button ...sonido.../>
 *   <CalmLantern />
 *
 * Claves i18n a añadir (es/en):
 *   header.calmaActivar    "Activar modo calma"
 *   header.calmaDesactivar "Desactivar modo calma"
 *   header.calmaSistema    "Modo calma fijado por tu sistema"
 *   header.calmaTooltip    "Tu dispositivo ya solicita menos movimiento,
 *                           así que el dojo está en calma. Se gestiona
 *                           desde los ajustes del sistema."
 */
function CalmLantern() {
  const { t } = useTranslation()
  const { calm, osReduced, toggle, announcement } = useCalmMode()
  const { play } = useSound()

  const label = osReduced
    ? t('header.calmaSistema')
    : calm
      ? t('header.calmaDesactivar')
      : t('header.calmaActivar')

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          // El click que ENCIENDE la calma suena; el mundo se apaga después.
          if (!calm) play('playClick')
          toggle()
        }}
        aria-pressed={calm}
        aria-label={label}
        title={osReduced ? undefined : label}
        className="group inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
      >
        <span className="as-lantern" data-calm={calm ? '' : undefined}>
          <span className="as-lantern__halo" aria-hidden="true" />
          <span className="as-lantern__layer as-lantern__layer--flame">
            <Flame className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="as-lantern__layer as-lantern__layer--ember">
            <Flame className="h-4 w-4 fill-current" aria-hidden="true" />
          </span>
        </span>
        {osReduced && (
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-bg/98 p-2.5 text-left text-xs leading-relaxed text-fg opacity-0 shadow-elev-2 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {t('header.calmaTooltip')}
          </span>
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </span>
  )
}

export default CalmLantern
