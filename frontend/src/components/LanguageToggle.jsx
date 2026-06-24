import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSound } from '../contexts/SoundContext'
import './ink-language.css'

/**
 * Idiomas como sellos hanko. `glyph` = sello compacto (ES / EN / 日), `label` =
 * autónimo (NO se traduce), `announce` = anuncio del live region en su idioma.
 * El glifo 日 (U+65E5) ya está en el subset de --font-kanji-serif → sin tofu.
 */
// `partial` = la traducción está incompleta (solo el catálogo i18n base; gran
// parte del producto sigue en español). Se marca con un sello "beta" en el
// popover para fijar expectativas sin ocultar el idioma.
const IDIOMAS = [
  { code: 'es', glyph: 'ES', label: 'Español', announce: 'idioma: español' },
  { code: 'en', glyph: 'EN', label: 'English', announce: 'language: English', partial: true },
  { code: 'ja', glyph: '日', label: '日本語', announce: '言語：日本語', partial: true },
]

/**
 * Toggle de idioma en Header — reskin "InkLanguage" (sellos hanko).
 *
 * <p>El trigger muestra el sello del idioma activo (ES / EN / 日) con un caret;
 * al pulsarlo se abre un popover de papel con los tres nombres completos. Al
 * elegir, {@code i18n.changeLanguage} dispara el cambio y el nuevo sello se
 * estampa con un golpe de hanko + sonido (respeta el mute global). La
 * preferencia se persiste en {@code localStorage.i18nextLng} vía
 * LanguageDetector — la próxima visita carga directamente el idioma elegido.
 *
 * <p>El idioma efectivo puede no estar entre los exactos (ej. 'es-ES' o
 * 'en-US' detectados del navegador). Por eso se calcula con slice(0, 2) para
 * mostrar el sello correcto sin caer a ES como default visual.
 *
 * <p>A11y (sin regresión respecto al dropdown previo): trigger con
 * aria-label / aria-expanded / aria-haspopup; popover role="menu" con
 * menuitemradio + aria-checked; teclado completo en trigger
 * (ArrowUp/Down/Enter/Space abren y enfocan) y en el menú
 * (ArrowUp/Down circular, Home/End, Escape cierra y devuelve foco al trigger,
 * Tab cierra, Enter/Space elige); foco al ítem activo al abrir y al trigger al
 * cerrar; click-outside (mousedown) cierra.
 */
function LanguageToggle() {
  const { i18n, t } = useTranslation()
  const { play } = useSound()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)
  const paperRef = useRef(null)
  const itemRefs = useRef([])
  const pendingFocusIndexRef = useRef(null)
  const menuId = useId()

  const codigoActivo = (i18n.resolvedLanguage || i18n.language || 'es')
      .toLowerCase()
      .slice(0, 2)
  const activo =
      IDIOMAS.find((l) => l.code === codigoActivo) ?? IDIOMAS[0]
  const activoIndex = Math.max(0, IDIOMAS.findIndex((l) => l.code === activo.code))

  // Cambio de idioma activo → evento de estampado (sonido + animación del
  // sello). Patrón canónico React 19 + Compiler: ajuste DURANTE el render con
  // guard, sin setState síncrono dentro de un effect.
  const [prevCodigo, setPrevCodigo] = useState(codigoActivo)
  const [stampEvent, setStampEvent] = useState(null)
  if (prevCodigo !== codigoActivo) {
    setPrevCodigo(codigoActivo)
    setStampEvent({ lang: codigoActivo, seq: stampEvent ? stampEvent.seq + 1 : 1 })
  }

  // Espejo de `play` en ref para no re-suscribir el effect del estampado en
  // cada render (play es estable, pero el espejo mantiene el contrato del
  // patrón y deja el effect dependiendo solo de stampEvent).
  const playRef = useRef(play)
  useEffect(() => {
    playRef.current = play
  })

  // Sonido del estampado: SIEMPRE desde un effect, una vez por cambio de
  // idioma (también si el cambio viene de fuera). Cero ceremonia al montar:
  // stampEvent es null hasta el primer cambio real.
  useEffect(() => {
    if (!stampEvent) return
    playRef.current('playSello')
  }, [stampEvent])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const index = pendingFocusIndexRef.current ?? activoIndex
    pendingFocusIndexRef.current = null
    itemRefs.current[index]?.focus()
  }, [activoIndex, open])

  const elegir = (code) => {
    if (code !== codigoActivo) i18n.changeLanguage(code)
    setOpen(false)
  }

  const cerrarYEnfocarTrigger = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const abrirYEnfocar = (index) => {
    pendingFocusIndexRef.current = index
    setOpen(true)
  }

  const enfocarItem = (index) => {
    const siguiente = (index + IDIOMAS.length) % IDIOMAS.length
    itemRefs.current[siguiente]?.focus()
  }

  const onTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      abrirYEnfocar(activoIndex)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      abrirYEnfocar(IDIOMAS.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      abrirYEnfocar(activoIndex)
    } else if (open && e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrarYEnfocarTrigger()
    }
  }

  const onItemKeyDown = (e, index, code) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      enfocarItem(index + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      enfocarItem(index - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      enfocarItem(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      enfocarItem(IDIOMAS.length - 1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrarYEnfocarTrigger()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      elegir(code)
      triggerRef.current?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const announced = stampEvent
    ? (IDIOMAS.find((l) => l.code === stampEvent.lang) || activo).announce
    : ''

  return (
    <div ref={wrapperRef} className="inklang inklang--popover">
      <button
        ref={triggerRef}
        type="button"
        className="inklang-btn inklang-trigger"
        aria-label={t('header.elegirIdioma')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          key={stampEvent ? stampEvent.seq : 0}
          className={`inklang-face is-active${stampEvent ? ' is-stamped' : ''}`}
          data-lang={activo.code}
          aria-hidden="true"
        >
          <span className="inklang-ink"></span>
          <span className="inklang-glyph">{activo.glyph}</span>
        </span>
        <span className="inklang-caret" aria-hidden="true"></span>
      </button>

      {open && (
        <div
          ref={paperRef}
          id={menuId}
          role="menu"
          aria-label={t('header.elegirIdioma')}
          className="inklang-paper"
        >
          {/*
            a11y: role='menuitemradio' + aria-checked anuncia el estado de
            selección al lector de pantalla ("Español, seleccionado") sin
            depender de ningún icono visual.
          */}
          {IDIOMAS.map((l, index) => {
            const elegido = l.code === activo.code
            return (
              <button
                key={l.code}
                ref={(node) => {
                  itemRefs.current[index] = node
                }}
                type="button"
                role="menuitemradio"
                aria-checked={elegido}
                tabIndex={-1}
                lang={l.code}
                onClick={() => elegir(l.code)}
                onKeyDown={(e) => onItemKeyDown(e, index, l.code)}
                className="inklang-item"
              >
                <span
                  className={elegido ? 'inklang-mini is-active' : 'inklang-mini'}
                  aria-hidden="true"
                >
                  {l.glyph}
                </span>
                <span className="inklang-item-name">{l.label}</span>
                {l.partial && <span className="inklang-item-tag">beta</span>}
              </button>
            )
          })}
        </div>
      )}

      <span
        className="inklang-live"
        role="status"
        aria-live="polite"
        lang={stampEvent ? stampEvent.lang : activo.code}
      >
        {announced}
      </span>
    </div>
  )
}

export default LanguageToggle
