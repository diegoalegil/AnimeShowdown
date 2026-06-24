import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import Dialog from './Dialog'

/**
 * Modal de captcha bajo abuso.
 *
 * <p>Se monta cuando el backend devuelve 428 Precondition Required en
 * el endpoint de voto, con body
 * <code>{captchaRequired: true, provider: 'turnstile', sitekey: '...'}</code>.
 * Lazy-loadea el script de Cloudflare Turnstile la primera vez (no
 * incluido en el bundle inicial — solo se carga cuando el usuario
 * realmente cae en captcha, que es la minoría).
 *
 * <p>El widget se renderiza explícito (no auto-render) para tener
 * control del ciclo de vida y poder llamar onSuccess/onClose desde el
 * callback del Turnstile API.
 *
 * <p>Si {@code sitekey} llega vacío (caso de Turnstile desactivado en
 * backend pero algún error de configuración mandó el 428), mostramos
 * una nota explícita en lugar de un widget roto.
 */

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onAnimeShowdownTurnstileReady&render=explicit'
const TURNSTILE_READY_FLAG = 'as_turnstile_ready'
const SCRIPT_LOAD_TIMEOUT_MS = 10_000

let scriptLoadingPromise = null

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptLoadingPromise) return scriptLoadingPromise
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      // Si el callback global no dispara en 10s, rechazar y resetear
      // para que reintentos futuros no devuelvan la promise colgada.
      if (scriptLoadingPromise) {
        scriptLoadingPromise = null
      }
      reject(new Error('Timeout cargando script de Turnstile (10s)'))
    }, SCRIPT_LOAD_TIMEOUT_MS)

    // Callback global que Turnstile invoca al cargar el script. Lo
    // exponemos en window con un nombre único para evitar colisiones
    // con otros widgets/captchas del proyecto futuros.
    window.onAnimeShowdownTurnstileReady = () => {
      clearTimeout(timeoutId)
      window[TURNSTILE_READY_FLAG] = true
      resolve(window.turnstile)
    }
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onerror = () => {
      clearTimeout(timeoutId)
      scriptLoadingPromise = null
      reject(new Error('No se pudo cargar el script de Turnstile'))
    }
    document.head.appendChild(script)
  })
  return scriptLoadingPromise
}

function CaptchaModal({ open, sitekey, onSuccess, onClose }) {
  const widgetRef = useRef(null)
  const widgetIdRef = useRef(null)
  // onSuccess por ref: el efecto que renderiza el widget NO debe depender de su
  // identidad. Si lo hiciera, un padre que pasa un callback inline (lo normal)
  // re-renderizaba el widget de Turnstile en CADA render, reseteándolo y pudiendo
  // bloquear al usuario en plena resolución.
  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])
  // Estado del widget Turnstile. Lo manipulan los callbacks del API,
  // nunca el body del useEffect — eso satisface react-hooks/set-state-in-effect
  // y mantiene el ciclo de vida claro: render setup en el effect, status
  // updates desde callbacks asíncronos (script load / widget errors).
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState(null)

  // Cortocircuito de render: sin sitekey no hay nada que verificar.
  // El estado de error se muestra directamente sin pasar por useEffect,
  // evitando el patrón de setState dentro del effect inicial.
  const sitekeyAusente = open && !sitekey

  useEffect(() => {
    if (!open || !sitekey) return undefined
    let mounted = true
    loadTurnstileScript()
      .then((turnstile) => {
        if (!mounted || !widgetRef.current) return
        // Limpieza defensiva: si quedó un widget viejo del último intento,
        // lo borramos antes de renderizar el nuevo.
        if (widgetIdRef.current && turnstile.remove) {
          try {
            turnstile.remove(widgetIdRef.current)
          } catch {
            /* no-op */
          }
          widgetIdRef.current = null
        }
        widgetIdRef.current = turnstile.render(widgetRef.current, {
          sitekey,
          theme: 'dark',
          callback: (token) => {
            // Token válido — el padre re-emite el voto con el header
            // X-AS-Captcha-Token. El modal se cierra desde fuera tras
            // procesar el éxito para evitar flicker.
            onSuccessRef.current(token)
          },
          'error-callback': () => {
            setStatus('error')
            setErrorMessage('El widget de captcha falló. Reintenta en unos segundos.')
          },
          'expired-callback': () => {
            // El token caducó antes de validarlo. Resetear el widget
            // para que el usuario pueda volver a resolverlo.
            if (widgetIdRef.current && window.turnstile?.reset) {
              window.turnstile.reset(widgetIdRef.current)
            }
          },
        })
        if (mounted) {
          setStatus('ready')
          setErrorMessage(null)
        }
      })
      .catch((err) => {
        if (!mounted) return
        setStatus('error')
        setErrorMessage(err?.message || 'No se pudo cargar el captcha.')
      })
    return () => {
      mounted = false
      // Removemos el widget al desmontar el modal — Turnstile mantiene
      // estado en window.turnstile y debe limpiarse para evitar leaks.
      const tk = typeof window !== 'undefined' ? window.turnstile : null
      if (tk && widgetIdRef.current && tk.remove) {
        try {
          tk.remove(widgetIdRef.current)
        } catch {
          /* no-op */
        }
        widgetIdRef.current = null
      }
    }
  }, [open, sitekey])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      titleId="captcha-modal-title"
      panelClassName="border-accent/40 shadow-elev-3"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 rounded-full border border-border bg-surface p-2 text-fg-muted transition-colors hover:border-accent/50 hover:text-gold"
        aria-label="Cerrar captcha"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-gold">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <h2 id="captcha-modal-title" className="text-xl font-black text-fg-strong">
        Confirma que no eres un bot
      </h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">
        Hemos detectado mucha actividad desde tu red en la última hora. Un
        captcha rápido confirma que eres humano y puedes seguir votando.
      </p>
      <div className="mt-5 flex min-h-[80px] items-center justify-center">
        {sitekeyAusente && (
          <p className="text-center text-sm text-danger">
            El captcha no está configurado en producción todavía. Vuelve a
            intentar más tarde.
          </p>
        )}
        {!sitekeyAusente && status === 'loading' && (
          <p className="text-sm text-fg-muted">Cargando captcha…</p>
        )}
        {!sitekeyAusente && status === 'error' && (
          <p className="text-center text-sm text-danger">
            {errorMessage ||
              'No se pudo cargar el captcha. Si el problema persiste, recarga la página.'}
          </p>
        )}
        <div
          ref={widgetRef}
          // Turnstile inyecta el iframe dentro de este div. Lo
          // mantenemos siempre montado para que el ref exista cuando
          // termine de cargar el script.
          className={!sitekeyAusente && status === 'ready' ? 'block' : 'hidden'}
        />
      </div>
    </Dialog>
  )
}

export default CaptchaModal
