import { useEffect, useMemo, useState } from 'react'
import { BellRing, BellOff, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  usePushPublicKey,
  usePushSubscribe,
  usePushUnsubscribe,
} from '../../../hooks/usePerfil'
import { ApiError } from '../../../lib/api'
import {
  soportaPush,
  urlBase64ToUint8Array,
  getLocalSubscription,
  subscriptionPayload,
} from '../../../lib/push'

function permissionActual() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function CardPushNotificaciones() {
  const supported = useMemo(() => soportaPush(), [])
  const [permission, setPermission] = useState(() => (
    supported ? permissionActual() : 'unsupported'
  ))
  const [subscribed, setSubscribed] = useState(false)
  const [checking, setChecking] = useState(true)
  const publicKeyQuery = usePushPublicKey({ enabled: supported })
  const subscribeMutation = usePushSubscribe()
  const unsubscribeMutation = usePushUnsubscribe()
  const busy = subscribeMutation.isPending || unsubscribeMutation.isPending

  useEffect(() => {
    let cancelled = false
    async function loadSubscription() {
      if (!supported) {
        setChecking(false)
        return
      }
      try {
        const current = await getLocalSubscription()
        if (!cancelled) {
          setSubscribed(Boolean(current))
          setPermission(permissionActual())
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    loadSubscription()
    return () => {
      cancelled = true
    }
  }, [supported])

  const enablePush = async () => {
    try {
      if (!supported) {
        throw new Error('Este navegador no soporta notificaciones push.')
      }
      const config = publicKeyQuery.data || await publicKeyQuery.refetch().then((r) => r.data)
      if (!config?.enabled || !config.publicKey) {
        throw new Error('Las notificaciones push aún no están activas en el servidor.')
      }

      let nextPermission = permissionActual()
      if (nextPermission === 'default') {
        nextPermission = await Notification.requestPermission()
      }
      setPermission(nextPermission)
      if (nextPermission !== 'granted') {
        throw new Error('Permiso de notificaciones denegado.')
      }

      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      })
      await subscribeMutation.mutateAsync(subscriptionPayload(subscription))
      setSubscribed(true)
      toast.success('Notificaciones activadas')
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message || `Error ${err.status}`
        : err instanceof Error
          ? err.message
          : 'No se pudieron activar las notificaciones.'
      toast.error('No se pudo activar push', { description: msg })
    }
  }

  const disablePush = async () => {
    try {
      const current = supported ? await getLocalSubscription() : null
      const endpoint = current?.endpoint
      if (current) await current.unsubscribe()
      await unsubscribeMutation.mutateAsync(endpoint)
      setSubscribed(false)
      toast.success('Notificaciones desactivadas')
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message || `Error ${err.status}`
        : 'No se pudieron desactivar las notificaciones.'
      toast.error('No se pudo desactivar push', { description: msg })
    }
  }

  const disabled = !supported || permission === 'denied'
  const statusText = !supported
    ? 'No disponible en este navegador'
    : permission === 'denied'
      ? 'Permiso bloqueado en el navegador'
      : subscribed
        ? 'Activo'
        : 'Inactivo'

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <BellRing className="h-4 w-4 text-gold" />
        <h2 className="text-lg font-bold text-fg-strong">Notificaciones push</h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-4">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${
            subscribed
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border bg-surface-alt text-fg-muted'
          }`}>
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : subscribed ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </span>
          <div>
            <p className="text-sm font-bold text-fg-strong">{statusText}</p>
            <p className="text-[11px] text-fg-muted">
              Torneos nuevos y finales cerradas.
            </p>
          </div>
        </div>

        {subscribed ? (
          <button
            type="button"
            onClick={disablePush}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-2 text-[13px] font-semibold text-fg-strong transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BellOff className="h-3.5 w-3.5" />
            {unsubscribeMutation.isPending ? 'Desactivando...' : 'Desactivar'}
          </button>
        ) : (
          <button
            type="button"
            onClick={enablePush}
            disabled={disabled || busy || checking}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BellRing className="h-3.5 w-3.5" />
            {subscribeMutation.isPending ? 'Activando...' : 'Activar'}
          </button>
        )}
      </div>
    </div>
  )
}

export default CardPushNotificaciones
