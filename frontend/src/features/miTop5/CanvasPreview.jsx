import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { recordDailyShare } from '../../lib/dailyProgress'
import PressSheet from '../../components/PressSheet'
import {
  buildTop5Alt,
  buildTop5ShareText,
  buildTop5ShareUrl,
  pintarTop5Blob,
} from './top5-share-card'

/**
 * Bloque de compartir de Mi Top 5. El dibujo del PNG 1200×630 (firma
 * carmesí/oro) NO cambia — vive en top5-share-card.pintarTop5Blob(), extraído
 * tal cual del antiguo generar() de este componente. La UI bespoke
 * (generar/descargar/compartir + textarea fallback) se sustituye por la hoja
 * de impresión (PressSheet): un único botón abre el modal, que pinta, muestra
 * preview y ofrece native/X/WhatsApp/copiar/descargar. recordDailyShare()
 * cuelga de onShared, igual que antes.
 */
function CanvasPreview({ slots, completo, personajesBySlug }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-3 text-sm font-semibold text-fg-muted">
        Compartir tu Top 5
      </h2>
      <p className="mb-4 text-[12px] text-fg-muted">
        {completo
          ? 'Genera la imagen 1200×630 de tu top 5 y compártela en cualquier red, o descárgala.'
          : `Faltan ${slots.filter((s) => !s).length} personajes para completar tu top 5.`}
      </p>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={!completo}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Share2 className="h-3.5 w-3.5" />
        Compartir mi Top 5
      </button>

      {completo && (
        <PressSheet
          open={abierto}
          onClose={() => setAbierto(false)}
          painter={() => pintarTop5Blob(slots, personajesBySlug)}
          contexto={{
            titulo: 'Mi Top 5 anime',
            texto: buildTop5ShareText(slots, personajesBySlug),
            url: buildTop5ShareUrl(slots),
            alt: buildTop5Alt(slots, personajesBySlug),
            fileName: 'animeshowdown-mi-top5.png',
            dims: [1200, 630],
          }}
          onShared={() => recordDailyShare()}
        />
      )}
    </div>
  )
}

export default CanvasPreview
