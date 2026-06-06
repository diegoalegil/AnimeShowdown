import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Avatar from '../../../components/Avatar'
import MonedaIcon from '../../../components/MonedaIcon'
import { endpoints, ApiError } from '../../../lib/api'
import { useAuth } from '../../../contexts/AuthContext'

const RAREZA_LABEL = {
  COMUN: 'Común',
  RARO: 'Raro',
  EPICO: 'Épico',
  LEGENDARIO: 'Legendario',
}

/**
 * Tienda de marcos de avatar (cosmético coin-sink). Compra con monedas y equipa
 * el aro/aura. El estado completo (saldo + catálogo con poseído/equipado) viene
 * de /api/me/marcos; comprar/equipar devuelven el MISMO estado, que usamos como
 * fuente de verdad (setQueryData) y propagamos al SaldoChip y al avatar global.
 */
function CardMarcos() {
  const { user, updateUser } = useAuth()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(null) // id en curso

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['marcos'],
    queryFn: endpoints.misMarcos,
    staleTime: 60_000,
  })

  const saldo = data?.saldo ?? 0
  const marcos = data?.marcos ?? []

  const aplicarEstado = (estado) => {
    queryClient.setQueryData(['marcos'], estado)
    // Refleja el nuevo saldo en el chip global del header al instante.
    queryClient.setQueryData(['monedero'], (old) => ({
      ...(old || {}),
      saldo: estado.saldo,
    }))
    queryClient.invalidateQueries({ queryKey: ['monedero'] })
    // Aro del avatar propio en toda la app (header, perfil…).
    updateUser({ marcoAvatar: estado.equipado ?? null })
  }

  const manejarError = (err, fallback) => {
    const msg =
      err instanceof ApiError
        ? err.message || `Error ${err.status}`
        : 'No se pudo conectar al servidor.'
    toast.error(fallback, { description: msg })
  }

  const comprar = async (m) => {
    setBusy(m.id)
    try {
      const estado = await endpoints.comprarMarco(m.id)
      aplicarEstado(estado)
      toast.success('¡Marco desbloqueado!', {
        description: `${m.nombre} es tuyo. Equípalo cuando quieras.`,
      })
    } catch (err) {
      manejarError(err, 'No se pudo comprar el marco')
    } finally {
      setBusy(null)
    }
  }

  const equipar = async (marcoId) => {
    setBusy(marcoId ?? '__quitar__')
    try {
      const estado = await endpoints.equiparMarco(marcoId)
      aplicarEstado(estado)
      toast.success(marcoId ? 'Marco equipado' : 'Marco quitado')
    } catch (err) {
      manejarError(err, 'No se pudo equipar el marco')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-fg-strong">Marcos de avatar</h2>
          <p className="text-[12px] text-fg-muted">
            Aros y auras para tu avatar. Se compran con monedas y se equipan
            cuando quieras.
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/12 bg-black/20 px-2 py-1 text-sm font-bold text-gold"
          title={`${saldo} monedas`}
        >
          <MonedaIcon className="h-4 w-4" />
          {saldo}
        </span>
      </div>

      {isPending ? (
        <p className="px-1 py-6 text-center text-[12px] text-fg-muted">
          Cargando marcos…
        </p>
      ) : isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-bg p-4">
          <p className="text-[12px] text-fg-muted">
            No pudimos cargar los marcos.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {marcos.map((m) => {
            const enCurso = busy === m.id
            const noLlega = !m.poseido && saldo < m.precio
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 rounded-xl border bg-bg p-3 transition-colors ${
                  m.equipado ? 'border-gold/60' : 'border-border'
                }`}
              >
                <Avatar user={user} size={52} marco={m.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-fg-strong">
                      {m.nombre}
                    </p>
                    {m.equipado && (
                      <span className="shrink-0 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                        Equipado
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-fg-muted">
                    {RAREZA_LABEL[m.rareza] || m.rareza} · {m.descripcion}
                  </p>
                  <div className="mt-2">
                    {!m.poseido ? (
                      <button
                        type="button"
                        onClick={() => comprar(m)}
                        disabled={enCurso || noLlega}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                        title={noLlega ? 'No te llega el saldo' : undefined}
                      >
                        <MonedaIcon className="h-3.5 w-3.5" />
                        {enCurso ? 'Comprando…' : noLlega ? `Faltan ${m.precio - saldo}` : `Comprar · ${m.precio}`}
                      </button>
                    ) : m.equipado ? (
                      <button
                        type="button"
                        onClick={() => equipar(null)}
                        disabled={busy === '__quitar__'}
                        className="inline-flex min-h-9 items-center rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-[13px] font-semibold text-fg-muted transition-colors hover:text-fg-strong disabled:opacity-50"
                      >
                        {busy === '__quitar__' ? 'Quitando…' : 'Quitar'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => equipar(m.id)}
                        disabled={enCurso}
                        className="inline-flex min-h-9 items-center rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-[13px] font-semibold text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
                      >
                        {enCurso ? 'Equipando…' : 'Equipar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CardMarcos
