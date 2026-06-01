import { useMemo, useState } from 'react'
import { ArrowRightLeft, Crown, Share2, ShieldCheck, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import Button from '../../components/Button'
import CartaFace from './CartaFace'
import { shareOrCopy } from '../../lib/share'
import { recordDailyShare } from '../../lib/dailyProgress'
import {
  useCartaShowcase,
  useCartaTrades,
  useCrearCartaTrade,
  useLimpiarCartaShowcase,
  useResolverCartaTrade,
  useSalonLegendario,
  useSetCartaShowcase,
} from '../../hooks/useCartas'
import { cartaShowcaseSlotLabel } from './carta-showcase-slots'

const SHOWCASE_SLOTS = ['PERFIL', 'DUEL_SKIN', 'SALON_1', 'SALON_2', 'SALON_3']
const SPECIAL_ONLY_SLOTS = new Set(['DUEL_SKIN', 'SALON_1', 'SALON_2', 'SALON_3'])
const EMPTY_LIST = []

function isEspecial(carta) {
  return carta?.rareza === 'ESPECIAL' || carta?.especialCurada
}

function cartaLabel(carta) {
  if (!carta) return 'Carta'
  const variante = carta.variante ? ` · ${carta.variante}` : ''
  return `${carta.personajeNombre} · ${carta.anime} · ${carta.rareza}${variante}`
}

function CartasSocialPanel({ cartas }) {
  const showcaseQ = useCartaShowcase()
  const tradesQ = useCartaTrades()
  const salonQ = useSalonLegendario()
  const setShowcase = useSetCartaShowcase()
  const limpiarShowcase = useLimpiarCartaShowcase()
  const crearTrade = useCrearCartaTrade()
  const resolverTrade = useResolverCartaTrade()

  const [slot, setSlot] = useState('PERFIL')
  const [showcaseCartaId, setShowcaseCartaId] = useState('')
  const [destinatarioUsername, setDestinatarioUsername] = useState('')
  const [cartaOfrecidaId, setCartaOfrecidaId] = useState('')
  const [cartaSolicitadaId, setCartaSolicitadaId] = useState('')

  const poseidas = useMemo(
    () => (Array.isArray(cartas) ? cartas.filter((carta) => carta.poseida) : []),
    [cartas],
  )
  const especiales = useMemo(
    () => poseidas.filter(isEspecial),
    [poseidas],
  )
  const candidatasShowcase = SPECIAL_ONLY_SLOTS.has(slot) ? especiales : poseidas
  const showcaseActual = Array.isArray(showcaseQ.data) ? showcaseQ.data : EMPTY_LIST
  const trades = Array.isArray(tradesQ.data) ? tradesQ.data : EMPTY_LIST
  const salon = Array.isArray(salonQ.data) ? salonQ.data : EMPTY_LIST
  const selectedShowcaseId = showcaseCartaId || candidatasShowcase[0]?.id || ''
  const selectedOfrecidaId = cartaOfrecidaId || poseidas[0]?.id || ''
  const selectedSolicitadaId = cartaSolicitadaId || cartas?.[0]?.id || ''

  async function fijarShowcase() {
    if (!selectedShowcaseId) return
    try {
      await setShowcase.mutateAsync({ slot, cartaId: Number(selectedShowcaseId) })
      toast.success('Carta fijada')
    } catch (error) {
      toast.error('No se pudo fijar la carta', { description: error?.message })
    }
  }

  async function limpiar(slotValue) {
    try {
      await limpiarShowcase.mutateAsync(slotValue)
      toast.success('Slot limpiado')
    } catch (error) {
      toast.error('No se pudo limpiar el slot', { description: error?.message })
    }
  }

  async function crearIntercambio(event) {
    event.preventDefault()
    if (!destinatarioUsername.trim() || !selectedOfrecidaId || !selectedSolicitadaId) return
    try {
      await crearTrade.mutateAsync({
        destinatarioUsername: destinatarioUsername.trim(),
        cartaOfrecidaId: Number(selectedOfrecidaId),
        cartaSolicitadaId: Number(selectedSolicitadaId),
        idempotencyKey: makeTradeIdempotencyKey(),
      })
      setDestinatarioUsername('')
      toast.success('Oferta enviada')
    } catch (error) {
      toast.error('No se pudo crear el intercambio', { description: error?.message })
    }
  }

  async function resolver(trade, action) {
    try {
      await resolverTrade.mutateAsync({ tradeId: trade.id, action })
      toast.success('Intercambio actualizado')
    } catch (error) {
      toast.error('No se pudo actualizar el intercambio', { description: error?.message })
    }
  }

  async function compartirCarta(carta) {
    if (!carta) return
    try {
      const result = await shareOrCopy({
        title: `Carta especial de ${carta.personajeNombre}`,
        text: `${carta.personajeNombre} de ${carta.anime} en carta especial de AnimeShowdown.`,
        url: `/cartas/${carta.id}`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Carta compartida' : 'Carta copiada')
    } catch (error) {
      toast.error('No se pudo compartir', { description: error?.message })
    }
  }

  return (
    <div className="mb-8 grid gap-4 xl:grid-cols-[1fr_1fr]">
      <section className="as-panel flex flex-col gap-4 rounded-2xl p-5">
        <PanelTitle icon={Crown} kicker="Escaparate" title="Cartas fijadas" />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <label className="flex flex-col gap-1.5 text-[12px] font-bold text-fg-muted">
            Slot
            <select
              value={slot}
              onChange={(event) => {
                setSlot(event.target.value)
                setShowcaseCartaId('')
              }}
              className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm text-fg-strong"
            >
              {SHOWCASE_SLOTS.map((slotValue) => (
                <option key={slotValue} value={slotValue}>
                  {cartaShowcaseSlotLabel(slotValue)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-bold text-fg-muted">
            Carta
            <select
              value={selectedShowcaseId}
              onChange={(event) => setShowcaseCartaId(event.target.value)}
              disabled={candidatasShowcase.length === 0}
              className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm text-fg-strong disabled:opacity-60"
            >
              {candidatasShowcase.length === 0 ? (
                <option value="">Sin cartas compatibles</option>
              ) : (
                candidatasShowcase.map((carta) => (
                  <option key={carta.id} value={carta.id}>
                    {cartaLabel(carta)}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={fijarShowcase}
            disabled={!selectedShowcaseId || setShowcase.isPending}
            size="sm"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Fijar
          </Button>
          <Button
            variant="secondary"
            onClick={() => limpiar(slot)}
            disabled={limpiarShowcase.isPending}
            size="sm"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Limpiar
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {showcaseActual.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-border p-4 text-[13px] text-fg-muted">
              Aun no tienes cartas fijadas.
            </div>
          ) : (
            showcaseActual.map((item) => (
              <article key={item.slot} className="min-w-0">
                <CartaFace carta={item.carta} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[12px] font-black text-fg-strong">
                    {cartaShowcaseSlotLabel(item.slot)}
                  </p>
                  {isEspecial(item.carta) && (
                    <button
                      type="button"
                      onClick={() => compartirCarta(item.carta)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-fg-muted transition-colors hover:border-gold/50 hover:text-gold"
                      aria-label={`Compartir carta de ${item.carta.personajeNombre}`}
                      title="Compartir"
                    >
                      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="as-panel flex flex-col gap-4 rounded-2xl p-5">
        <PanelTitle icon={ArrowRightLeft} kicker="Trading" title="Intercambios" />
        <form onSubmit={crearIntercambio} className="grid gap-3">
          <label className="flex flex-col gap-1.5 text-[12px] font-bold text-fg-muted">
            Usuario
            <input
              value={destinatarioUsername}
              onChange={(event) => setDestinatarioUsername(event.target.value)}
              className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm text-fg-strong"
              autoComplete="off"
              placeholder="username"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[12px] font-bold text-fg-muted">
              Ofreces
              <select
                value={selectedOfrecidaId}
                onChange={(event) => setCartaOfrecidaId(event.target.value)}
                disabled={poseidas.length === 0}
                className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm text-fg-strong disabled:opacity-60"
              >
                {poseidas.length === 0 ? (
                  <option value="">Sin cartas</option>
                ) : (
                  poseidas.map((carta) => (
                    <option key={carta.id} value={carta.id}>
                      {cartaLabel(carta)}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-bold text-fg-muted">
              Pides
              <select
                value={selectedSolicitadaId}
                onChange={(event) => setCartaSolicitadaId(event.target.value)}
                disabled={!Array.isArray(cartas) || cartas.length === 0}
                className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm text-fg-strong disabled:opacity-60"
              >
                {Array.isArray(cartas) && cartas.length > 0 ? (
                  cartas.map((carta) => (
                    <option key={carta.id} value={carta.id}>
                      {cartaLabel(carta)}
                    </option>
                  ))
                ) : (
                  <option value="">Sin catalogo</option>
                )}
              </select>
            </label>
          </div>
          <Button
            type="submit"
            disabled={!destinatarioUsername.trim() || !selectedOfrecidaId || !selectedSolicitadaId || crearTrade.isPending}
          >
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
            Enviar oferta
          </Button>
        </form>

        <div className="grid gap-2">
          {trades.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-[13px] text-fg-muted">
              No hay intercambios activos.
            </p>
          ) : (
            trades.slice(0, 6).map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                pending={resolverTrade.isPending && resolverTrade.variables?.tradeId === trade.id}
                onResolve={resolver}
              />
            ))
          )}
        </div>
      </section>

      <section className="as-panel flex flex-col gap-4 rounded-2xl p-5 xl:col-span-2">
        <PanelTitle icon={ShieldCheck} kicker="Salon legendario" title="Especiales de la comunidad" />
        {salon.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-[13px] text-fg-muted">
            Aun no hay cartas en el salon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {salon.slice(0, 12).map((item) => (
              <article key={`${item.username}-${item.slot}-${item.carta.id}`} className="min-w-0">
                <CartaFace carta={item.carta} />
                <p className="mt-2 truncate text-[12px] font-black text-fg-strong">{item.carta.personajeNombre}</p>
                <p className="truncate text-[11px] text-fg-muted">@{item.username}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function TradeRow({ trade, pending, onResolve }) {
  const isPending = trade.estado === 'PENDING'
  const incoming = trade.rol === 'DESTINATARIO'
  return (
    <article className="rounded-xl border border-border bg-bg/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-black uppercase tracking-[0.12em] text-fg-muted">
          {trade.estado}
        </p>
        <p className="text-[12px] text-fg-muted">
          {trade.solicitanteUsername} {'->'} {trade.destinatarioUsername}
        </p>
      </div>
      <div className="mt-2 grid gap-2 text-sm text-fg sm:grid-cols-2">
        <p className="truncate">
          <span className="font-bold text-fg-strong">Ofrece:</span> {trade.cartaOfrecida?.personajeNombre}
        </p>
        <p className="truncate">
          <span className="font-bold text-fg-strong">Pide:</span> {trade.cartaSolicitada?.personajeNombre}
        </p>
      </div>
      {isPending && (
        <div className="mt-3 flex flex-wrap gap-2">
          {incoming ? (
            <>
              <Button size="sm" onClick={() => onResolve(trade, 'accept')} disabled={pending}>
                Aceptar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onResolve(trade, 'reject')} disabled={pending}>
                Rechazar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => onResolve(trade, 'cancel')} disabled={pending}>
              Cancelar
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

function PanelTitle({ icon: Icon, kicker, title }) {
  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-gold">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {kicker}
      </p>
      <h2 className="mt-1 text-lg font-black text-fg-strong">{title}</h2>
    </div>
  )
}

function makeTradeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `trade-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default CartasSocialPanel
