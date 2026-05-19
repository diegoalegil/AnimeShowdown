import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSeo } from '../hooks/useSeo'

function readNext() {
  try {
    const stored = sessionStorage.getItem('animeshowdown.oauth.next')
    sessionStorage.removeItem('animeshowdown.oauth.next')
    return stored && stored.startsWith('/') && !stored.startsWith('//') ? stored : '/'
  } catch {
    return '/'
  }
}

function AuthCallbackPage() {
  useSeo({
    title: 'Completando acceso',
    description: 'Completando el acceso externo a AnimeShowdown.',
    noindex: true,
  })
  const { finalizeOAuthLogin } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const failed = params.get('oauth') === 'error'
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (failed) {
      navigate('/login?oauth=error', { replace: true })
      return
    }
    let cancelled = false
    finalizeOAuthLogin()
      .then(() => {
        if (!cancelled) navigate(readNext(), { replace: true })
      })
      .catch(() => {
        if (!cancelled) navigate('/login?oauth=error', { replace: true })
      })
    return () => {
      cancelled = true
    }
  }, [failed, finalizeOAuthLogin, navigate])

  return (
    <section className="flex flex-1 items-center justify-center px-5 py-20">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-accent">
          {failed ? (
            <TriangleAlert className="h-5 w-5" />
          ) : (
            <ShieldCheck className="h-5 w-5" />
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {failed ? 'No se pudo completar el acceso' : 'Completando acceso'}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {failed
            ? 'Te llevamos de vuelta al login para intentarlo de nuevo.'
            : 'Estamos recuperando tu sesión segura.'}
        </p>
        {!failed && (
          <Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-accent" />
        )}
      </div>
    </section>
  )
}

export default AuthCallbackPage
