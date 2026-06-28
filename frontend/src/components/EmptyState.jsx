import { isValidElement } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import EditorialCover from './EditorialCover'
import { BRAND_VISUALS } from '../data/visual-assets'
import './empty-scene.css'

/* Glifo canónico por escena (variante compacta del vacío bajo 480px). */
const SCENE_GLYPH = {
  drawer: '空', // vacío — búsqueda sin resultados
  plaza: '祭', // festival/plaza — sin contenido aún
  seal: '乱', // desorden — error recuperable
  path: '界', // frontera/mundo — página intermedia vacía
}

/* Escenas a nivel de módulo (React Compiler: jamás componentes anidados). */

function DrawerScene() {
  return (
    <div className="es-scene es-drawer">
      <div className="es-drawer-void">
        <span className="es-kanji">空</span>
      </div>
      <div className="es-drawer-front" />
    </div>
  )
}

function PlazaScene() {
  return (
    <div className="es-scene es-plaza">
      <div className="es-lantern">
        <span className="es-lantern-glow" />
        <span className="es-kanji">祭</span>
      </div>
    </div>
  )
}

function SealScene() {
  return (
    <div className="es-scene es-seal">
      <div className="es-seal-half es-seal-a">
        <span className="es-kanji">乱</span>
      </div>
      <div className="es-seal-half es-seal-b">
        <span className="es-kanji">乱</span>
      </div>
    </div>
  )
}

function PathScene() {
  return (
    <div className="es-scene es-path">
      <span className="es-kanji es-path-mark">界</span>
      <span className="es-chevron" />
      <span className="es-chevron" />
      <span className="es-chevron" />
    </div>
  )
}

const SCENES = { drawer: DrawerScene, plaza: PlazaScene, seal: SealScene, path: PathScene }

function isStructuredAction(action) {
  return (
    action &&
    typeof action === 'object' &&
    !Array.isArray(action) &&
    !isValidElement(action) &&
    typeof action.to === 'string' &&
    action.to.length > 0 &&
    typeof action.label === 'string' &&
    action.label.length > 0
  )
}

function isRenderableAction(action) {
  if (action === null || action === undefined || typeof action === 'boolean') {
    return false
  }
  if (typeof action === 'string' || typeof action === 'number') return true
  if (isValidElement(action)) return true
  if (Array.isArray(action)) return action.every(isRenderableAction)
  return false
}

function EmptyStateAction({ action, linkClassName, wrapperClassName }) {
  if (isStructuredAction(action)) {
    return (
      <Link to={action.to} className={linkClassName}>
        {action.label}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    )
  }

  if (isRenderableAction(action)) {
    return <div className={wrapperClassName}>{action}</div>
  }

  return null
}

function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  action,
  className = '',
  scene = false,
  visual = BRAND_VISUALS.empty,
  escena,
}) {
  const body = children ?? description
  const hasCustomBody = children !== undefined && children !== null

  if (scene) {
    return (
      <div
        role="status"
        className={`relative flex min-h-80 flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-dashed border-white/12 bg-surface/50 p-8 text-center sm:p-12 ${className}`}
        style={{
          '--empty-accent': visual?.accentRgb ?? '159 29 44',
          '--empty-glow': visual?.glowRgb ?? '197 161 90',
        }}
      >
        {/* Wrapper posicionado en vez de pasarle `absolute` a EditorialCover:
            su raíz ya trae `relative` y cuál de las dos clases de posición
            gana depende del orden interno del CSS de Tailwind, no del
            className — con `relative` ganando, el cover colapsaba a una
            miniatura del tamaño de su contenido. */}
        <div aria-hidden="true" className="absolute inset-0">
          <EditorialCover
            visual={visual}
            className="h-full w-full rounded-none border-0 opacity-70"
            imageClassName="saturate-110 contrast-105"
          />
        </div>
        {Icon && (
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/35 bg-gold/10 text-gold shadow-aura [--aura-color:rgb(197_161_90_/_0.8)]">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
        {title && (
          <h2 className="relative max-w-xl text-2xl font-black tracking-tight text-fg-strong">
            {title}
          </h2>
        )}
        {body && (
          <div className="relative max-w-lg text-sm leading-7 text-fg-muted">{body}</div>
        )}
        <EmptyStateAction
          action={action}
          linkClassName="relative inline-flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/90 px-5 py-3 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
          wrapperClassName="relative mt-2 flex flex-wrap justify-center gap-3"
        />
      </div>
    )
  }

  // La escena kanji ES el grafismo del vacío (migración al kit): sustituye al
  // badge de icono, que ya no se pinta en este modo. La escena se elige por la
  // prop `escena`; si no se pasa, se deriva del contexto: un icono de error
  // (AlertTriangle) → 'seal' (乱, role=alert); el resto → 'plaza' (祭).
  const sceneKey =
    escena && SCENES[escena] ? escena : Icon === AlertTriangle ? 'seal' : 'plaza'
  const Scene = SCENES[sceneKey]
  const isError = sceneKey === 'seal'

  return (
    <div
      className={`es-root as-panel flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-dashed p-8 text-center sm:p-12 es-s-${sceneKey} ${className}`.trim()}
      role={isError ? 'alert' : 'status'}
    >
      <div className="es-stage" aria-hidden="true">
        <span className="es-glyph">{SCENE_GLYPH[sceneKey]}</span>
        <Scene />
      </div>
      <div className="flex max-w-xl flex-col gap-2">
        {title && (
          <h2 className="text-2xl font-black tracking-tight text-fg-strong">{title}</h2>
        )}
        {body &&
          (hasCustomBody ? (
            <div className="text-sm leading-7 text-fg-muted">{body}</div>
          ) : (
            <p className="text-sm leading-7 text-fg-muted">{body}</p>
          ))}
      </div>
      <EmptyStateAction
        action={action}
        linkClassName="mt-2 inline-flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/90 px-5 py-3 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
        wrapperClassName="mt-2 flex flex-wrap justify-center gap-3"
      />
    </div>
  )
}

export default EmptyState
