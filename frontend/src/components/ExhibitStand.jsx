import { Suspense, useCallback, useEffect, useState } from 'react'
import AccessibleDialog from './AccessibleDialog'
import ErrorBoundary from './ErrorBoundary'
import KanjiStroke from './KanjiStroke'
import PersonajeImg from './PersonajeImg'
import { useSound } from '../contexts/SoundContext'
import './exhibit-stand.css'

/* -------------------------------------------------------------------------
 * Canvas pieza 113 · La peana del 3D — escenario del visor Personaje3D on-demand.
 *
 * ExhibitStand es el WRAPPER del visor: NO toca el <canvas> 3D ni su carga
 * lazy (sigue siendo el chunk de 877KB que importa el caller). Esta pieza
 * es el ESCENARIO alrededor — peana de exposición + tatami en penumbra +
 * antesala de carga (形 trazándose) + tablillas de control + degradación
 * honesta cuando WebGL falla.
 *
 * El visor se inyecta como {children} para que el caller mantenga el
 * import() dinámico y el slug donde ya vive:
 *
 *   const Personaje3D = lazy(() => import('./Personaje3D'))
 *   <ExhibitStand open={open} onClose={...} nombre={p.nombre}
 *                 fallbackUrl={imagenCatalogo} slug={slug}>
 *     <Personaje3D slug={slug} />
 *   </ExhibitStand>
 * ------------------------------------------------------------------------- */

/** Detecta el error de creación de contexto WebGL (guard ya existente en la
 *  ficha). Mismo criterio que PersonajeDetailPage para no reportar a Sentry
 *  un fallo esperado de hardware/driver. */
function isExpectedWebGLRenderError(error) {
  const message = String(error?.message || error || '')
  return /error creating webgl context|could not create webgl context|webglrenderer/i.test(
    message,
  )
}

/**
 * Antesala de carga del chunk 3D. Reutiliza el lenguaje de #96: el kanji
 * 形 (katachi — "forma") se traza trazo a trazo con KanjiStroke mientras
 * el modelo aún no ha llegado. Es el fallback de <Suspense>.
 *
 * @param {{ replayKey?: number|string }} props
 */
function Antesala({ replayKey }) {
  return (
    <div className="exhibit-stand__antesala" role="status" aria-live="polite">
      <span className="exhibit-stand__antesala-kanji">
        <KanjiStroke
          kanji="形"
          size="1em"
          strokeMs={520}
          gapMs={140}
          color="var(--color-gold)"
          replayKey={replayKey}
        />
      </span>
      <span className="exhibit-stand__antesala-label">
        Dando forma a la figura…
      </span>
    </div>
  )
}

/**
 * Envoltorio del nodo que se posa en la peana (visor 3D o imagen de
 * respaldo). Al MONTAR dispara el asentamiento (CSS, vía .exhibit-stand__
 * figure) y un clack de madera. Como Suspense sólo lo inserta cuando el
 * chunk resuelve, el sonido y el settle quedan sincronizados con la llegada
 * del modelo sin nada de estado en JS.
 *
 * @param {{ onSettle?: () => void, children: React.ReactNode }} props
 */
function ExhibitFigure({ onSettle, children }) {
  useEffect(() => {
    onSettle?.()
    // Sólo al montar: el clack/settle es un evento puntual de aterrizaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <div className="exhibit-stand__figure">{children}</div>
}

/**
 * @typedef {Object} ExhibitStandProps
 * @property {boolean} open                 Controla la apertura del diálogo modal.
 * @property {() => void} onClose           Cierre (Escape, backdrop, tablilla ✕).
 *                                          El foco vuelve al disparador (AccessibleDialog).
 * @property {string} nombre                Nombre del personaje — grabado en la peana
 *                                          y usado en los aria-label.
 * @property {string} slug                  Slug del personaje (para PersonajeImg del fallback).
 * @property {string} [fallbackUrl]         URL de la imagen estática (ratio 2:3) que se
 *                                          muestra si WebGL falla.
 * @property {string} [colorDominante]      Color dominante de la carta (lo pasa PersonajeImg).
 * @property {boolean} [webglUnavailable=false]  Si el caller ya sabe que no hay WebGL,
 *                                          abre directamente en modo imagen (sin montar el visor).
 * @property {(deltaDeg: number) => void} [onRotate]  Hook de rotación por teclado/tablilla.
 *                                          DEPENDE de que Personaje3D exponga rotación
 *                                          imperativa; ver notas de handoff. Si se omite,
 *                                          las tablillas siguen visibles (el arrastre sobre
 *                                          el canvas rota nativamente vía OrbitControls).
 * @property {React.ReactNode} children     El visor lazy, p.ej. <Personaje3D slug={slug} />.
 */

/**
 * @param {ExhibitStandProps} props
 */
function ExhibitStand({
  open,
  onClose,
  nombre,
  slug,
  fallbackUrl,
  colorDominante,
  webglUnavailable = false,
  onRotate,
  children,
}) {
  const { play } = useSound()

  // Las tablillas se atenúan mientras el usuario rota y vuelven al soltar.
  const [rotating, setRotating] = useState(false)

  // Apertura: whoosh del escenario al montar (efecto, no render → compiler OK).
  useEffect(() => {
    if (!open) return
    play('playWhoosh')
  }, [open, play])

  // Fin de rotación a nivel documento: si el puntero se suelta fuera del slot
  // igual reactivamos las tablillas. setState en callback de evento → legal.
  useEffect(() => {
    if (!rotating) return undefined
    const up = () => setRotating(false)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [rotating])

  const handleClose = useCallback(() => {
    play('playClick')
    onClose?.()
  }, [onClose, play])

  const handleSettle = useCallback(() => {
    // El modelo (o el fallback) acaba de posarse en la peana.
    play('playClack')
  }, [play])

  const rotateBy = useCallback(
    (delta) => {
      onRotate?.(delta)
    },
    [onRotate],
  )

  // Flechas ←/→ rotan (si el visor lo expone). Handler de evento → compiler OK.
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        rotateBy(-15)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        rotateBy(15)
      }
    },
    [rotateBy],
  )

  // Imagen estática de respaldo (WebGL caído). Se posa en la peana igual que
  // el modelo, con el mismo asentamiento.
  const fallbackFigure = (
    <ExhibitFigure onSettle={handleSettle}>
      <PersonajeImg
        slug={slug}
        src={fallbackUrl}
        colorDominante={colorDominante}
        alt={`${nombre} — figura en imagen`}
        loading="eager"
        sizes="(min-width: 768px) 460px, 86vw"
        fit="contain"
        position="bottom"
      />
    </ExhibitFigure>
  )

  return (
    <AccessibleDialog
      open={open}
      onClose={handleClose}
      label={`Vista 3D de ${nombre}`}
      panelClassName="!max-w-none !border-0 !bg-transparent !p-0 !shadow-none w-auto overflow-visible"
    >
      <div
        className={`exhibit-stand${rotating ? ' is-rotating' : ''}`}
        onKeyDown={handleKeyDown}
      >
        {/* Tatami en penumbra + UN foco radial estático */}
        <div className="exhibit-stand__floor" aria-hidden="true" />
        <div className="exhibit-stand__watermark" aria-hidden="true" lang="ja">
          形
        </div>

        <div className="exhibit-stand__viewport">
          {/* Slot del modelo: aquí monta el <canvas> 3D (children) o el
              fallback. El arrastre con el puntero atenúa las tablillas. */}
          <div
            className="exhibit-stand__model"
            onPointerDown={() => setRotating(true)}
          >
            {webglUnavailable ? (
              fallbackFigure
            ) : (
              <ErrorBoundary
                fallback={fallbackFigure}
                shouldReportError={(error) => !isExpectedWebGLRenderError(error)}
              >
                <Suspense fallback={<Antesala />}>
                  <ExhibitFigure onSettle={handleSettle}>
                    {children}
                  </ExhibitFigure>
                </Suspense>
              </ErrorBoundary>
            )}
          </div>

          {/* La peana de exposición: tarima circular con el nombre grabado */}
          <div className="exhibit-stand__pedestal" aria-hidden="true">
            <div className="exhibit-stand__pedestal-shadow" />
            <div className="exhibit-stand__pedestal-side">
              <span className="exhibit-stand__engrave">{nombre}</span>
            </div>
            <div className="exhibit-stand__pedestal-top" />
          </div>
        </div>

        {/* Aviso honesto cuando no hay WebGL — integrado al escenario, no toast */}
        {webglUnavailable && (
          <div className="exhibit-stand__notice" role="status">
            <span className="exhibit-stand__notice-dot" aria-hidden="true" />
            <span>
              Tu navegador no puede mostrar la vista 3D ahora mismo. Te dejamos
              la figura en imagen.
            </span>
          </div>
        )}

        {/* Tablillas flotantes: rotar izquierda / derecha */}
        <div className="exhibit-stand__controls">
          <button
            type="button"
            className="exhibit-stand__tablilla"
            aria-label={`Girar ${nombre} a la izquierda`}
            onClick={() => rotateBy(-15)}
          >
            <RotateLeftIcon />
          </button>
          <button
            type="button"
            className="exhibit-stand__tablilla"
            aria-label={`Girar ${nombre} a la derecha`}
            onClick={() => rotateBy(15)}
          >
            <RotateRightIcon />
          </button>
        </div>

        {/* Tablilla de cierre */}
        <div className="exhibit-stand__close">
          <button
            type="button"
            className="exhibit-stand__tablilla"
            aria-label="Cerrar vista 3D"
            onClick={handleClose}
          >
            <CloseIcon />
            <span className="exhibit-stand__tablilla-label">Cerrar</span>
          </button>
        </div>
      </div>
    </AccessibleDialog>
  )
}

/* Iconos a nivel de módulo (react-refresh): trazos finos, currentColor. */
function RotateLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3 9a9 9 0 1 1-1.5 5" strokeLinecap="round" />
      <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function RotateRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M21 9a9 9 0 1 0 1.5 5" strokeLinecap="round" />
      <path d="M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  )
}

export default ExhibitStand
