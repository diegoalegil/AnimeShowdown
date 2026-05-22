import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Languages } from 'lucide-react'

const IDIOMAS = [
  { code: 'es', label: 'Español', short: 'ES' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ja', label: '日本語', short: 'JA' },
]

/**
 * Toggle de idioma en Header (Plan v2 §4.11).
 *
 * <p>Pequeño botón con el código del idioma actual (ES / EN). Click abre
 * dropdown con la lista; al elegir, {@code i18n.changeLanguage} dispara
 * el cambio. La preferencia se persiste en {@code localStorage.i18nextLng}
 * vía LanguageDetector — la próxima visita carga directamente el idioma
 * elegido.
 *
 * <p>El idioma efectivo puede no estar entre los exactos (ej. 'es-ES' o
 * 'en-US' detectados del navegador). Por eso se calcula con startsWith
 * para mostrar el chip correcto sin caer a ES como default visual.
 */
function LanguageToggle() {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const codigoActivo = (i18n.resolvedLanguage || i18n.language || 'es')
      .toLowerCase()
      .slice(0, 2)
  const activo =
      IDIOMAS.find((l) => l.code === codigoActivo) ?? IDIOMAS[0]

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

  const elegir = (code) => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('header.elegirIdioma')}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
      >
        <Languages className="h-4 w-4" />
        <span className="text-[11px] font-bold tracking-wider tabular-nums">
          {activo.short}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-40 origin-top-right rounded-xl border border-border bg-surface py-1 opacity-100 shadow-2xl transition-[opacity,transform] duration-150 ease-out"
        >
          {/*
            Audit a11y (2026-05-17): role='menuitem' no anunciaba estado
            de selección al lector de pantalla — solo el icono Check
            visual revelaba el idioma activo. menuitemradio + aria-checked
            hace que SR diga "Español, seleccionado" sin depender del icono.
          */}
          {IDIOMAS.map((l) => {
            const elegido = l.code === activo.code
            return (
              <button
                key={l.code}
                type="button"
                role="menuitemradio"
                aria-checked={elegido}
                onClick={() => elegir(l.code)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-bg ${
                  elegido
                    ? 'font-semibold text-fg-strong'
                    : 'text-fg-muted'
                }`}
              >
                <span className="inline-flex w-7 font-mono text-[11px] font-bold uppercase">
                  {l.short}
                </span>
                <span lang={l.code === 'ja' ? 'ja' : undefined} className="flex-1">
                  {l.label}
                </span>
                {elegido && <Check className="h-3.5 w-3.5 text-gold" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default LanguageToggle
