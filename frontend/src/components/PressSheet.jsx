import { useCallback, useEffect, useId, useRef, useState } from 'react'
import AccessibleDialog from './AccessibleDialog'
import { useSoundOptional } from '../contexts/SoundContext'
import './press-sheet.css'

/**
 * La hoja de impresión — el modal único de compartir de la casa.
 *
 * <p>Unifica los 4 flujos de share (mi-top5, duelo, anime, wrapped) en un solo
 * componente. La hoja NO sabe pintar: recibe el pintor canvas como prop
 * (función async que devuelve un Blob PNG) y se limita a la coreografía:
 * shōji → pincel placeholder → corte de tinta → tablillas.
 *
 * <p>Privacidad: ninguna petición sale a ningún servicio sin el click
 * explícito del usuario en su tablilla. Los intents de X/WhatsApp se
 * construyen EN el click, nunca antes.
 *
 * <p>CSS asociado: bloque `as-press-*` en press-sheet.css (importado arriba).
 * CSP por hash: cero estilos inyectados en runtime; todo keyframe vive en el
 * stylesheet del componente.
 *
 * @param {object} props
 * @param {boolean} props.open                    Controlado por el caller.
 * @param {() => void} props.onClose
 * @param {() => Promise<Blob>} props.painter     Pintor canvas async (top5 / duelo / wrapped /
 *                                                anime). Debe resolver un Blob image/png o
 *                                                rechazar con un Error legible. La hoja lo
 *                                                reintenta bajo demanda — debe ser re-invocable.
 * @param {object} props.contexto                 Datos del share — vienen del flujo, la hoja no inventa nada.
 * @param {string} props.contexto.titulo          p.ej. 'Mi Top 5 anime'.
 * @param {string} props.contexto.texto           Texto plano del share (X / WhatsApp / nativo).
 * @param {string} props.contexto.url             Ruta relativa compartible ('/mi-top5?add=…').
 * @param {string} props.contexto.alt             Alt generado del contexto ('Tu top 5: 1. …').
 * @param {string} props.contexto.fileName        Nombre de descarga ('animeshowdown-mi-top5.png').
 * @param {[number, number]} props.contexto.dims  [ancho, alto] de la imagen que pinta el painter.
 * @param {(via: 'native'|'x'|'whatsapp'|'copy'|'download') => void} [props.onShared]
 *        Hook de instrumentación — aquí cuelga recordDailyShare() y telemetría.
 *        La hoja no importa dailyProgress para no acoplarse a un flujo.
 *
 * @example
 * <PressSheet
 *   open={abierto}
 *   onClose={() => setAbierto(false)}
 *   painter={() => pintarTop5Blob(slots, personajesBySlug)}
 *   contexto={{
 *     titulo: 'Mi Top 5 anime',
 *     texto: buildTop5ShareText(slots, personajesBySlug),
 *     url: buildTop5ShareUrl(slots),
 *     alt: buildTop5Alt(slots, personajesBySlug),
 *     fileName: 'animeshowdown-mi-top5.png',
 *     dims: [1200, 630],
 *   }}
 *   onShared={(via) => { recordDailyShare(); track('share', { via }) }}
 * />
 */
function PressSheet({ open, onClose, painter, contexto, onShared }) {
  const titleId = useId()
  const { play } = useSoundOptional() // respeta el mute global; no-op sin SoundProvider

  // idle → painting → revealing → ready | error
  const [fase, setFase] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [preview, setPreview] = useState(null) // { url, blob, kb }
  const [copiado, setCopiado] = useState(false)
  const [selloKey, setSelloKey] = useState(0)
  const [hundida, setHundida] = useState(false)
  const [descargado, setDescargado] = useState('')
  const [aviso, setAviso] = useState('') // live region

  const tokenRef = useRef(0)
  const urlRef = useRef(null)
  // painter en ref: los call-sites lo pasan inline (() => pintarXBlob(...)), que
  // cambia de identidad en cada render del padre. Si entrara en las deps de
  // pintar(), repintaríamos el lienzo (revoke + nuevo Blob + flicker) en cada
  // render del árbol mientras el modal está abierto. La ref lo desacopla.
  const painterRef = useRef(painter)
  useEffect(() => {
    painterRef.current = painter
  }, [painter])
  const reduce = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const absUrl = typeof window !== 'undefined'
    ? new URL(contexto.url, window.location.origin).toString()
    : contexto.url

  // ── pintar (y repintar): el painter llega como prop, la hoja no pinta ──
  // Flujo sin imagen (p.ej. compartir un ranking de anime que es solo
  // texto+enlace): sin painter se salta la fase de pintado y la hoja queda
  // en 'ready' directamente — preview vacío, descargar deshabilitado, pero
  // copiar / X / WhatsApp / nativo siguen vivos.
  const pintar = useCallback(async () => {
    const fn = painterRef.current
    if (!fn) {
      tokenRef.current += 1
      setErrorMsg('')
      setFase('ready')
      return
    }
    const token = ++tokenRef.current
    setFase('painting')
    setErrorMsg('')
    try {
      const blob = await fn()
      if (token !== tokenRef.current) return
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = URL.createObjectURL(blob)
      urlRef.current = url
      setPreview({ url, blob, kb: Math.round(blob.size / 1024) })
      // El corte de tinta es animación CSS de montaje (cero fases JS extra):
      // 'revealing' monta el cover, onAnimationEnd pasa a 'ready'.
      setFase(reduce ? 'ready' : 'revealing')
    } catch (err) {
      if (token !== tokenRef.current) return
      setFase('error')
      setErrorMsg(err?.message || 'El pintor no entregó la imagen.')
    }
  }, [reduce])

  useEffect(() => {
    if (!open) return undefined
    // Defer del primer pintado a un microtask: así NINGÚN setState corre
    // síncrono en el cuerpo del efecto (react-hooks/set-state-in-effect). El
    // token-guard de pintar() ya invalida si se cierra antes de resolver.
    let vivo = true
    queueMicrotask(() => {
      if (vivo) pintar()
    })
    return () => {
      vivo = false
      tokenRef.current += 1 // invalida pintados en vuelo al cerrar
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
      setPreview(null)
      setFase('idle')
      setCopiado(false)
      setDescargado('')
      setAviso('')
    }
  }, [open, pintar])

  // ── destinos: NADA sale sin click ─────────────────────────────────────
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(absUrl)
      setCopiado(true)
      setSelloKey((k) => k + 1) // re-key = re-estampar el sello 写
      setAviso('Enlace copiado al portapapeles')
      play?.('playSello')
      onShared?.('copy')
      window.setTimeout(() => setCopiado(false), 2600)
    } catch {
      setAviso('No se pudo copiar — selecciona el enlace a mano')
    }
  }

  const descargar = () => {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview.url
    a.download = contexto.fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setHundida(true)
    window.setTimeout(() => setHundida(false), 200)
    setDescargado(`${contexto.fileName} · ${fmtKB(preview.kb)}`)
    setAviso('Imagen guardada en tu equipo')
    onShared?.('download')
  }

  const abrirX = () => {
    const u = new URL('https://x.com/intent/post')
    u.searchParams.set('text', `${contexto.texto}\n${absUrl}`)
    window.open(u.toString(), '_blank', 'noopener,noreferrer')
    onShared?.('x')
  }

  const abrirWhatsApp = () => {
    const u = new URL('https://wa.me/')
    u.searchParams.set('text', `${contexto.texto}\n${absUrl}`)
    window.open(u.toString(), '_blank', 'noopener,noreferrer')
    onShared?.('whatsapp')
  }

  // Web Share progresivo: con archivo si el UA lo soporta, si no texto+url.
  const archivoShare = preview?.blob && typeof File !== 'undefined'
    ? new File([preview.blob], contexto.fileName, { type: 'image/png' })
    : null
  const nativeDisponible = typeof navigator !== 'undefined' && Boolean(navigator.share)
  const nativeConArchivo = nativeDisponible && archivoShare
    && (!navigator.canShare || navigator.canShare({ files: [archivoShare] }))

  const compartirNativo = async () => {
    try {
      await navigator.share(
        nativeConArchivo
          ? { title: contexto.titulo, text: contexto.texto, url: absUrl, files: [archivoShare] }
          : { title: contexto.titulo, text: contexto.texto, url: absUrl },
      )
      onShared?.('native')
    } catch (err) {
      if (err?.name !== 'AbortError') setAviso('No se pudo abrir la hoja nativa')
    }
  }

  const pesada = (preview?.kb ?? 0) > 1200
  const [anchoImg, altoImg] = contexto.dims ?? []
  const conImagen = Boolean(painter)

  return (
    <AccessibleDialog
      open={open}
      onClose={onClose}
      titleId={titleId}
      panelClassName="as-press-panel max-w-md p-5"
      // Las puertas shōji son la animación de montaje del wrapper de la casa;
      // la hoja hereda focus trap, Escape, inert y restore del foco.
    >
      <div className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-bold text-fg-strong">Compartir</h2>
          <p className="mt-0.5 font-mono text-[11px] text-fg-muted">
            {contexto.titulo}{conImagen && anchoImg ? ` · ${anchoImg}×${altoImg}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-white/5 hover:text-gold"
        >
          ✕
        </button>
      </div>

      {/* Zona de imagen: pincel → corte de tinta → preview (solo si hay painter) */}
      {conImagen && (
      <div
        className="relative overflow-hidden rounded-xl border border-border bg-canvas"
        style={{ aspectRatio: altoImg > anchoImg ? '1 / 1' : `${anchoImg} / ${altoImg}` }}
      >
        {preview && fase !== 'painting' && fase !== 'error' && (
          <img
            src={preview.url}
            alt={contexto.alt}
            width={anchoImg}
            height={altoImg}
            className={`absolute inset-0 h-full w-full object-contain ${reduce ? 'as-press-img-fade' : ''}`}
          />
        )}

        {fase === 'painting' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5">
            {/* Pincel dibujando: dash loop suave; estático con reduced-motion;
                pausado fuera del viewport vía animation-play-state (clase .is-paused
                puesta por un IntersectionObserver del caller o el hook usePausaFueraDeViewport) */}
            <svg width="88" height="88" viewBox="0 0 96 96" aria-hidden="true">
              <circle cx="48" cy="48" r="38" fill="none" stroke="var(--color-gold-soft)" strokeWidth="2" />
              <circle
                cx="48" cy="48" r="38" fill="none"
                stroke="var(--color-gold)" strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray="150 89"
                className={reduce ? 'opacity-70' : 'as-press-brush'}
              />
            </svg>
            <p className="font-mono text-[11px] text-fg-muted">
              pintando el lienzo… <span className="text-gold">{anchoImg}×{altoImg}</span>
            </p>
          </div>
        )}

        {fase === 'error' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 p-4 text-center">
            <span aria-hidden="true" className="text-3xl text-gold/40" style={{ fontFamily: 'var(--font-kanji-serif)' }}>断</span>
            <p className="text-sm font-bold text-fg-strong">El lienzo no ha respondido.</p>
            <p className="max-w-[280px] font-mono text-[10px] text-accent-text">{errorMsg}</p>
            <p className="text-[11px] text-fg-muted">Tu enlace sigue funcionando — solo falta la imagen.</p>
            <button
              type="button"
              onClick={pintar}
              className="mt-2 min-h-11 rounded-lg border border-gold/45 bg-gold-soft px-4 text-sm font-bold text-gold transition-transform ease-lift hover:-translate-y-px"
            >
              Reintentar el lienzo
            </button>
          </div>
        )}

        {fase === 'revealing' && (
          <div
            aria-hidden="true"
            className="as-press-cover absolute inset-0 z-20"
            onAnimationEnd={() => setFase('ready')}
          >
            <span className="as-press-edge absolute bottom-0 right-0 top-0 w-[3px]" />
          </div>
        )}
      </div>
      )}

      {conImagen && fase === 'ready' && preview && (
        <p className={`mt-1.5 px-0.5 font-mono text-[10px] ${pesada ? 'text-gold' : 'text-fg-muted'}`}>
          {anchoImg}×{altoImg} · PNG · {fmtKB(preview.kb)}
          {pesada && ' — pesada para adjuntar en X; mejor descarga o WhatsApp'}
        </p>
      )}

      {/* Enlace en mono con su botón */}
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-bg p-1.5 pl-3">
        <div className="relative min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-fg">{sinProtocolo(absUrl)}</p>
          {copiado && <span key={`ul${selloKey}`} aria-hidden="true" className="as-press-underline absolute -bottom-0.5 left-0 right-0 h-0.5 bg-gold" />}
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={copiar}
            aria-label="Copiar enlace al portapapeles"
            className="min-h-11 rounded-lg border border-gold/30 px-3.5 font-mono text-[11px] text-gold transition-colors hover:border-gold/60"
          >
            copiar
          </button>
          {copiado && (
            <span key={`sello${selloKey}`} aria-hidden="true" className="as-press-sello pointer-events-none absolute -right-2 -top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-hanko bg-bg/95 text-[19px] font-bold text-hanko shadow-elev-1" style={{ fontFamily: 'var(--font-kanji-serif)' }}>
              <span className="as-press-anillo absolute -inset-1.5 rounded-full border border-hanko/55" aria-hidden="true" />
              写
            </span>
          )}
        </div>
      </div>

      {/* Tablillas — mismo peso; con Web Share nativa la primaria manda */}
      {nativeDisponible ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <button type="button" onClick={compartirNativo} className="as-press-tablilla-primaria relative flex min-h-14 items-center justify-center gap-2.5 rounded-xl border border-accent/55 bg-gradient-to-b from-accent-hover to-accent text-sm font-black text-white shadow-aura inset-shadow-hairline-strong transition-transform ease-lift hover:-translate-y-0.5 hover:brightness-110">
            compartir…
          </button>
          <div className="grid grid-cols-4 gap-2">
            <TablillaCompacta etiqueta="X" aria="Compartir en X: abre el intent con tu texto y tu enlace" onClick={abrirX} />
            <TablillaCompacta etiqueta="WhatsApp" aria="Compartir por WhatsApp: abre wa.me con tu texto y tu enlace" onClick={abrirWhatsApp} />
            <TablillaCompacta etiqueta="Copiar" aria="Copiar el enlace al portapapeles" onClick={copiar} />
            <TablillaCompacta etiqueta="Descargar" aria="Descargar la imagen como PNG" onClick={descargar} disabled={!preview} hundida={hundida} />
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Tablilla etiqueta="X" sub="intent · texto + enlace" aria="Compartir en X: abre el intent con tu texto y tu enlace" onClick={abrirX} />
          <Tablilla etiqueta="WhatsApp" sub="wa.me · texto + enlace" aria="Compartir por WhatsApp: abre wa.me con tu texto y tu enlace" onClick={abrirWhatsApp} />
          <Tablilla etiqueta="Copiar enlace" sub="portapapeles" aria="Copiar el enlace al portapapeles" onClick={copiar} />
          <Tablilla etiqueta="Descargar imagen" sub="PNG local" aria="Descargar la imagen como PNG" onClick={descargar} disabled={!preview} hundida={hundida} />
        </div>
      )}

      {descargado && (
        <p className="mt-2.5 px-0.5 font-mono text-[10.5px] text-gold">↓ {descargado}</p>
      )}

      {/* Confirmaciones en live region (copiar / descargar / errores de destino) */}
      <p role="status" aria-live="polite" className="mt-2.5 min-h-4 px-0.5 font-mono text-[10.5px] text-fg-muted">
        {aviso}
      </p>
    </AccessibleDialog>
  )
}

/**
 * Tablilla ema de destino — mismo peso visual para todos los destinos.
 * @param {string} etiqueta  Texto principal.
 * @param {string} sub       Qué sale exactamente del dispositivo (honestidad/privacidad).
 * @param {string} aria      Label completo del botón.
 */
function Tablilla({ etiqueta, sub, aria, onClick, disabled = false, hundida = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      aria-disabled={disabled}
      className={`as-press-tablilla relative flex min-h-16 items-center gap-3 rounded-xl border border-gold/30 p-3 text-left text-fg-strong transition-transform ease-lift hover:-translate-y-0.5 hover:border-gold/55 ${disabled ? 'opacity-45' : ''} ${hundida ? 'as-press-hundida' : ''}`}
    >
      <span aria-hidden="true" className="as-press-clavo" />
      <span className="min-w-0">
        <span className="block text-[13px] font-bold">{etiqueta}</span>
        <span className="block font-mono text-[9.5px] text-fg-muted">{sub}</span>
      </span>
    </button>
  )
}

/** Variante compacta para el modo Web Share nativa (secundarias bajo la primaria). */
function TablillaCompacta({ etiqueta, aria, onClick, disabled = false, hundida = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      aria-disabled={disabled}
      className={`as-press-tablilla flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-gold/20 p-2 text-fg-muted transition-transform ease-lift hover:-translate-y-0.5 hover:border-gold/50 hover:text-fg-strong ${disabled ? 'opacity-45' : ''} ${hundida ? 'as-press-hundida' : ''}`}
    >
      <span className="text-[9.5px] font-semibold">{etiqueta}</span>
    </button>
  )
}

function fmtKB(kb) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1).replace('.', ',')} MB` : `${kb} KB`
}

function sinProtocolo(url) {
  return url.replace(/^https?:\/\//, '')
}

export default PressSheet
