import { useEffect, useRef, useState } from 'react'
import './broadcast-interruption.css'

/**
 * BroadcastInterruption — pantalla de error global del ErrorBoundary, contada
 * como interrupción de la retransmisión: carta de ajuste sobria en carmesí /
 * oro / cian APAGADOS, sello 乱 (interrupción) estampado con overshoot de
 * hanko, y dos salidas honestas.
 *
 * Escena (montaje, una sola vez):
 * - 0–300 ms: estática FINGIDA — dos capas pre-horneadas (gradientes
 *   repetidos) parpadean SOLO por opacity en steps(3). Sin canvas, sin
 *   feTurbulence, sin filters: es lo único que WebKit compone bien.
 * - 140–680 ms: las barras de la carta de ajuste se asientan
 *   (translateY → 0, 560 ms var(--ease-lift), escalonado 45 ms vía --bi-d).
 * - 620–1140 ms: el sello 乱 cae con overshoot (520 ms ease-stamp,
 *   cubic-bezier(0.34, 1.56, 0.64, 1)); el sangrado es una copia escalada
 *   al 30% que cross-fadea su opacity a los 1020 ms (capa pre-renderizada,
 *   cero blur).
 * - 320/400/480/900 ms: eyebrow, titular, acciones y franja del parte
 *   suben con bi-rise (540 ms var(--ease-lift)).
 *
 * Supervivencia (este componente se monta cuando el árbol ya reventó):
 * - CERO dependencias más allá de React: ni router (los links son <a>
 *   planos), ni react-query, ni SoundContext, ni hooks compartidos del árbol.
 * - Los estilos CRÍTICOS van inline (fondo, color, layout, botones ≥ 44 px)
 *   con fallback de color dentro de var(): si index.css no cargó, la pantalla
 *   sigue legible y operativa. Las clases bi-* y de tokens solo AÑADEN color
 *   de barras, tipografía de marca y movimiento.
 *   NOTA sobre el guard de CI: veta hex (#) en JSX; los fallbacks degradados
 *   usan canales de color a conciencia — ver NOTAS-HANDOFF.md §degradado.
 * - prefers-reduced-motion se lee con matchMedia inline (inicializador puro,
 *   StrictMode-safe), sin importar useReducedMotionPref: con reduced-motion
 *   no hay estática y todo nace en su estado final (los keyframes solo
 *   definen el "from").
 * - Sin loops infinitos: todo es play-once; nada que pausar por viewport.
 * - Los @keyframes y clases bi-* viven en index.css (CSP por hash — nada de
 *   <style> en runtime).
 *
 * A11y:
 * - role="alert" en el bloque del titular (se anuncia al montar).
 * - Las dos acciones son <button>/<a> reales con focus visible (outline oro).
 * - Copiar el parte confirma de forma NO solo-visual: texto en una región
 *   aria-live polite además del subrayado de tinta de 400 ms.
 *
 * @param {object} props
 * @param {string} [props.eventId] Identificador del parte (p. ej.
 *   Sentry.lastEventId() desde el boundary). Si falta o es vacío, la franja
 *   del parte NO se renderiza — nunca un "undefined" en pantalla.
 * @param {boolean} [props.esChunkError=false] true cuando el error es un
 *   chunk-load tras un deploy (error.name === 'ChunkLoadError' o
 *   /Loading chunk|dynamically imported module/i). Cambia el subtítulo a
 *   «hay una versión nueva del recinto — recarga para actualizar» y el
 *   primario hace location.reload() (reload duro).
 * @param {() => void} [props.onRetry] Reset del boundary (re-monta el árbol).
 *   Si falta, el primario degrada a location.reload().
 */

const SR_ONLY = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

// Colores de barra por clase (broadcast-interruption.css). Si index.css no
// cargó, las barras quedan transparentes: decorativo que falla en silencio.
const BARRAS = [
  'bi-bar-carmesi',
  'bi-bar-tinta',
  'bi-bar-oro',
  'bi-bar-pizarra',
  'bi-bar-cian',
  'bi-bar-tinta',
  'bi-bar-niebla',
]

function BroadcastInterruption({ eventId, esChunkError = false, onRetry }) {
  // Lectura pura (sin suscripción): el boundary vive segundos, no merece
  // listener de change. StrictMode monta doble sin efectos colaterales.
  const [reducido] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [copiado, setCopiado] = useState(false)
  const [mensajeLive, setMensajeLive] = useState('')
  const timeoutRef = useRef(0)

  useEffect(() => () => window.clearTimeout(timeoutRef.current), [])

  const alAccionar = () => {
    // Chunk viejo tras un deploy → la única salida sana es el reload duro.
    if (esChunkError || typeof onRetry !== 'function') {
      window.location.reload()
      return
    }
    onRetry()
  }

  const copiarParte = async () => {
    if (!eventId) return
    try {
      await navigator.clipboard.writeText(eventId)
    } catch {
      // El clipboard puede no existir tras un crash parcial (o sin permisos):
      // fallback clásico con textarea — y si también falla, el id sigue
      // visible y seleccionable en pantalla.
      try {
        const area = document.createElement('textarea')
        area.value = eventId
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        area.remove()
      } catch { /* sin clipboard: no rompemos nada */ }
    }
    window.clearTimeout(timeoutRef.current)
    setCopiado(true)
    setMensajeLive('Identificador del parte copiado')
    timeoutRef.current = window.setTimeout(() => {
      setCopiado(false)
      setMensajeLive('')
    }, 2200)
  }

  const subtitulo = esChunkError
    ? 'Hay una versión nueva del recinto — recarga para actualizar.'
    : 'Algo se ha roto en nuestro lado del cable. Tu sesión y tus votos están a salvo.'
  const etiquetaPrimario = esChunkError ? 'Recargar' : 'Reintentar'

  return (
    <section
      className="min-h-dvh bg-canvas text-fg"
      // CRÍTICO: si index.css no cargó, esto mantiene la pantalla legible. Por eso
      // estos var() llevan el literal del token como fallback (canvas #04070c /
      // fg #d7dce7): sin él, una caída de la hoja de estilos dejaba la pantalla
      // de crash sin fondo ni color. (BroadcastInterruption.jsx está en la
      // allowlist del guard de color justamente por estos 2 literales de rescate.)
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
        padding: 'clamp(48px, 9vw, 84px) clamp(18px, 5vw, 56px)',
        background: 'var(--color-canvas, #04070c)',
        color: 'var(--color-fg, #d7dce7)',
        fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Estática fingida: 2 capas pre-horneadas, parpadeo por opacity 300 ms,
          UNA vez. Con reduced-motion no se montan siquiera. */}
      {!reducido && (
        <>
          <div aria-hidden="true" className="bi-static-a" style={estiloEstaticaA} />
          <div aria-hidden="true" className="bi-static-b" style={estiloEstaticaB} />
        </>
      )}

      <div style={{ position: 'relative', width: '100%', maxWidth: 620 }}>
        {/* Carta de ajuste + sello 乱 */}
        <div style={{ position: 'relative' }}>
          <div
            className="border-border bg-bg"
            style={{
              overflow: 'hidden',
              borderRadius: 14,
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="bi-bars" style={{ display: 'flex', height: 'clamp(118px, 26vw, 184px)', overflow: 'hidden' }}>
              {BARRAS.map((clase, i) => (
                <div
                  key={i}
                  className={`bi-bar ${clase}`}
                  style={{ flex: 1, '--bi-d': `${140 + i * 45}ms` }}
                />
              ))}
            </div>
            <div
              className="font-mono text-fg-muted"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '9px 14px',
                fontSize: 11,
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
              }}
            >
              <span>carta de ajuste · cabina 04</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span aria-hidden="true" className="bg-electric" style={{ width: 6, height: 6, opacity: 0.85 }} />
                sin señal
              </span>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="bi-stamp"
            style={{
              position: 'absolute',
              right: -4,
              top: 'clamp(-54px, -8vw, -30px)',
              zIndex: 2,
              transform: 'rotate(-6deg)',
            }}
          >
            {/* Sangrado del sello: copia escalada, cross-fade de opacity. */}
            <span aria-hidden="true" className="bi-bleed font-kanji-serif text-hanko" style={{ ...estiloKanji, position: 'absolute', inset: 0, transform: 'scale(1.05)', opacity: 0.3 }}>
              乱
            </span>
            <span lang="ja" className="font-kanji-serif text-hanko" style={{ ...estiloKanji, position: 'relative', display: 'block' }}>
              乱
            </span>
          </div>
        </div>

        <p className="bi-rise-1 text-gold" style={{ margin: '28px 0 0', fontSize: 13, fontWeight: 600 }}>
          Retransmisión de la cabina
        </p>

        <div role="alert" className="bi-rise-2">
          <h1
            className="font-display text-fg-strong"
            style={{
              margin: '10px 0 0',
              fontSize: 'clamp(30px, 5.4vw, 46px)',
              lineHeight: 1.12,
              letterSpacing: '-0.01em',
              fontWeight: 700,
              color: 'var(--color-fg-strong)',
              textWrap: 'balance',
            }}
          >
            Perdimos la señal de la cabina
          </h1>
          <p className="text-fg-muted" style={{ margin: '14px 0 0', maxWidth: '52ch', fontSize: 15.5, lineHeight: 1.65 }}>
            {subtitulo}
          </p>
        </div>

        <div className="bi-rise-3" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 28 }}>
          {/* Sello primario. CRÍTICO inline: visible y pulsable sin CSS. */}
          <button
            type="button"
            onClick={alAccionar}
            className="bi-accion-primaria"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              minHeight: 48,
              padding: '0 24px',
              borderRadius: 8,
              border: '1px solid var(--color-accent-hover)',
              background: 'var(--color-accent)',
              color: 'var(--color-fg-strong)',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <span lang="ja" aria-hidden="true" className="font-kanji-serif" style={{ fontSize: 16, fontWeight: 700, opacity: 0.9 }}>
              再
            </span>
            {etiquetaPrimario}
          </button>
          {/* <a> plano a propósito: cero router en la pantalla de crash. */}
          <a
            href="/"
            className="bi-accion-secundaria"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 48,
              padding: '0 22px',
              boxSizing: 'border-box',
              borderRadius: 8,
              border: '1px solid var(--color-border-gold-subtle)',
              color: 'var(--color-gold)',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Volver al inicio
          </a>
        </div>

        {/* Franja del parte: solo si HAY eventId. */}
        {eventId ? (
          <div
            className="bi-rise-4"
            style={{ marginTop: 34, paddingTop: 8, borderTop: '1px solid var(--color-border-gold-subtle)' }}
          >
            <button
              type="button"
              onClick={copiarParte}
              aria-label={`Copiar el identificador del parte ${eventId}`}
              className="bi-parte font-mono text-fg-muted"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 44,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12.5,
                color: 'var(--color-fg-muted)',
              }}
            >
              <span>parte nº</span>
              <span style={{ position: 'relative', color: 'var(--color-fg-strong)' }}>
                {eventId}
                <span
                  aria-hidden="true"
                  className={copiado && !reducido ? 'bi-underline-run' : undefined}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -4,
                    height: 2,
                    background: 'var(--color-gold)',
                    transformOrigin: 'left center',
                    opacity: copiado ? 1 : 0,
                    transition: 'opacity 260ms ease',
                  }}
                />
              </span>
              <span style={{ opacity: 0.55 }}>— copiar</span>
              <span aria-hidden="true" className="text-gold" style={{ opacity: copiado ? 1 : 0, transition: 'opacity 240ms ease' }}>
                copiado
              </span>
            </button>
            {/* Confirmación NO solo-visual. */}
            <span aria-live="polite" role="status" style={SR_ONLY}>
              {mensajeLive}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

// Capas de estática pre-horneadas: gradientes repetidos, base opacity 0 (la
// clase bi-static-* las hace parpadear UNA vez; sin clase, invisibles).
const estiloEstaticaA = {
  position: 'absolute',
  inset: 0,
  zIndex: 6,
  pointerEvents: 'none',
  opacity: 0,
  background:
    'repeating-linear-gradient(0deg, color-mix(in srgb, var(--color-fg-strong) 8%, transparent) 0px, color-mix(in srgb, var(--color-fg-strong) 8%, transparent) 1px, transparent 1px, transparent 3px, color-mix(in srgb, var(--color-fg-strong) 3%, transparent) 3px, color-mix(in srgb, var(--color-fg-strong) 3%, transparent) 4px, transparent 4px, transparent 7px)',
}
const estiloEstaticaB = {
  position: 'absolute',
  inset: 0,
  zIndex: 6,
  pointerEvents: 'none',
  opacity: 0,
  background:
    'repeating-linear-gradient(90deg, color-mix(in srgb, var(--color-fg-strong) 5%, transparent) 0px, color-mix(in srgb, var(--color-fg-strong) 5%, transparent) 9px, color-mix(in srgb, var(--color-canvas) 25%, transparent) 9px, color-mix(in srgb, var(--color-canvas) 25%, transparent) 14px, color-mix(in srgb, var(--color-fg-strong) 2%, transparent) 14px, color-mix(in srgb, var(--color-fg-strong) 2%, transparent) 26px, transparent 26px, transparent 31px)',
}

const estiloKanji = {
  color: 'var(--color-hanko)',
  fontWeight: 700,
  fontSize: 'clamp(104px, 16vw, 164px)',
  lineHeight: 1,
}

export default BroadcastInterruption
