import { RefreshCw } from 'lucide-react'

function StaleRouteRecovery() {
  const handleReload = () => {
    window.location.reload()
  }

  return (
    <section
      className="as-stage relative isolate flex min-h-[72svh] flex-1 items-center px-5 py-16 text-fg-strong sm:px-8"
      role="alert"
      aria-live="assertive"
      data-stale-route-recovery="true"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-lg border border-gold/30 bg-surface/88 p-6 shadow-aura backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-black text-gold">
            Nueva versión disponible
          </p>
          <h1 className="text-3xl font-black text-fg-strong sm:text-4xl">
            Actualiza esta pantalla
          </h1>
          <p className="max-w-xl text-sm leading-7 text-fg-muted sm:text-base">
            La página que estabas abriendo pertenece a una versión anterior del
            bundle. Recarga para tomar los archivos nuevos y volver al combate.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReload}
          className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg border border-accent/55 bg-gradient-to-b from-accent-hover to-accent px-5 py-3 text-sm font-black text-white shadow-aura inset-shadow-hairline-strong transition-all hover:-translate-y-0.5 hover:brightness-110"
        >
          <RefreshCw className="h-4 w-4" />
          Recargar página
        </button>
      </div>
    </section>
  )
}

export default StaleRouteRecovery
