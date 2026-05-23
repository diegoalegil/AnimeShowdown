import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'

/**
 * Easter egg Konami Code (Plan v2 §13.12).
 *
 * <p>Secuencia clásica: ↑↑↓↓←→←→BA. Al completarla activa un overlay
 * temporal "modo arcade" con un mensaje + scanline retro CSS, durante
 * 8 segundos. Es feedback al user; no cambia funcionalidad.
 *
 * <p>El estado vive en este componente, no global — si el user navega
 * de página el contador se reinicia (queremos que sea un acto deliberado
 * sin trampas pre-cargadas).
 *
 * <p>Implementación: listener global de keydown que va acumulando teclas
 * en una secuencia. Se compara con la secuencia objetivo de longitud 10.
 * Si la última tecla rompe la secuencia, se resetea silenciosamente.
 */
const SECUENCIA = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]

function KonamiCode() {
  const [activo, setActivo] = useState(false)

  useEffect(() => {
    let secuenciaActual = []
    let autoOffTimer = null

    const onKey = (e) => {
      // Ignorar si el usuario está escribiendo en un input/textarea.
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
        return
      }
      const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const esperado = SECUENCIA[secuenciaActual.length]
      if (tecla === esperado) {
        secuenciaActual.push(tecla)
        if (secuenciaActual.length === SECUENCIA.length) {
          secuenciaActual = []
          setActivo(true)
          toast('↑↑↓↓←→←→BA', {
            description: 'Modo arcade desbloqueado por 8 segundos.',
            icon: '👾',
            duration: 4000,
          })
          // Auto-off tras 8s. Ajuste (2026-05-17): antes timeout suelto
          // sin tracking — si el componente se desmontaba antes (nav o
          // route change), disparaba setState en componente desmontado.
          // Trackeamos en autoOffTimer para cancelar en el cleanup del
          // effect.
          if (autoOffTimer) clearTimeout(autoOffTimer)
          autoOffTimer = setTimeout(() => setActivo(false), 8000)
        }
      } else if (tecla === SECUENCIA[0]) {
        // Empieza nueva secuencia si la tecla fallida coincide con el
        // primer paso (typical: ↑ tras un error).
        secuenciaActual = [tecla]
      } else {
        secuenciaActual = []
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (autoOffTimer) clearTimeout(autoOffTimer)
    }
  }, [])

  if (!activo) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
    >
      {/* Scanlines retro CRT */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0,255,170,0.04) 0px, rgba(0,255,170,0.04) 1px, transparent 1px, transparent 4px)',
        }}
      />
      <div className="pointer-events-none rounded-2xl border-4 border-emerald-400 bg-emerald-500/10 px-10 py-8 text-center font-mono shadow-[0_0_60px_rgba(0,255,170,0.4)] backdrop-blur-sm">
        <Sparkles className="mx-auto mb-2 h-8 w-8 text-emerald-300" />
        <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300/80">
          Cheat code activado
        </p>
        <p className="mt-2 text-2xl font-bold text-emerald-200">
          ↑↑↓↓←→←→BA
        </p>
        <p className="mt-3 text-[12px] text-emerald-300/70">
          Modo arcade · {Math.ceil(8 - 0)}s
        </p>
      </div>
    </div>
  )
}

export default KonamiCode
