import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, PackageOpen } from 'lucide-react'
import Section from '../components/Section'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Dialog from '../components/Dialog'
import CartaTile from '../components/CartaTile'
import MonedaIcon from '../components/MonedaIcon'
import { useAuth } from '../contexts/AuthContext'
import { useColeccion, useOddsCartas, useAbrirSobre } from '../hooks/useCartas'

const PAGE_SIZE = 60

function CartasPage() {
  const { user } = useAuth()
  const coleccionQ = useColeccion()
  const oddsQ = useOddsCartas()
  const abrirSobre = useAbrirSobre()

  const [visibles, setVisibles] = useState(PAGE_SIZE)
  const [reveal, setReveal] = useState(null)

  if (!user) {
    return (
      <Section eyebrow="Cartas" title="Colecciona a tus personajes">
        <EmptyState
          icon={Sparkles}
          title="Inicia sesión para coleccionar"
          description="Gana moneda jugando, abre sobres y completa tu colección de cartas de anime."
          action={{ to: '/login', label: 'Entrar' }}
        />
      </Section>
    )
  }

  const data = coleccionQ.data
  const precio = oddsQ.data?.precioSobre ?? null
  const saldo = data?.saldo ?? 0
  const totalCatalogo = data?.totalCatalogo ?? 0
  const totalPoseidas = data?.totalPoseidas ?? 0
  const porcentaje = data?.porcentaje ?? 0
  const cartas = data?.cartas ?? []
  const puedeAbrir = precio != null && saldo >= precio && !abrirSobre.isPending
  const faltan = precio != null ? Math.max(0, precio - saldo) : null

  async function abrir() {
    try {
      const res = await abrirSobre.mutateAsync()
      setReveal(res)
    } catch {
      // El error se muestra vía abrirSobre.isError abajo.
    }
  }

  return (
    <Section
      eyebrow="Cartas"
      title="Tu colección"
      description="Gana moneda jugando y ábrela en sobres. Cada carta es un personaje con su universo."
    >
      {/* Monedero + sobre + probabilidades transparentes (anti-casino) */}
      <div className="as-panel mb-8 flex flex-col gap-5 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <MonedaIcon className="h-7 w-7 text-gold" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-fg-muted">Tu saldo</p>
              <p className="text-2xl font-black leading-none text-fg-strong">{saldo}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.12em] text-fg-muted">Colección</p>
            <p className="text-2xl font-black leading-none text-fg-strong">
              {totalPoseidas}
              <span className="text-base font-bold text-fg-muted"> / {totalCatalogo}</span>
              <span className="ml-2 text-base font-bold text-gold">{porcentaje}%</span>
            </p>
          </div>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-alt"
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${porcentaje}%` }} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={abrir} disabled={!puedeAbrir} size="lg">
            <PackageOpen className="h-5 w-5" aria-hidden="true" />
            {abrirSobre.isPending ? 'Abriendo…' : 'Abrir sobre'}
            {precio != null && (
              <span className="inline-flex items-center gap-1 font-mono">
                · {precio}
                <MonedaIcon className="h-4 w-4" />
              </span>
            )}
          </Button>
          <p className="text-[12px] leading-5 text-fg-muted">
            Probabilidades:{' '}
            {(oddsQ.data?.rarezas ?? []).map((r) => `${r.rareza} ${Math.round(r.probabilidad * 100)}%`).join(' · ') ||
              'SSR 100%'}
            . Se gana jugando, nunca con dinero real.
          </p>
        </div>

        {!coleccionQ.isLoading && faltan != null && faltan > 0 && (
          <p className="text-[12px] text-fg-muted">
            Te faltan <span className="font-bold text-gold">{faltan}</span> monedas. Gánalas votando, ganando
            duelos, prediciendo torneos o completando la misión diaria.
          </p>
        )}
        {abrirSobre.isError && (
          <p className="text-[12px] text-danger">No se pudo abrir el sobre. Inténtalo de nuevo.</p>
        )}
      </div>

      {/* Grid de la colección */}
      {coleccionQ.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-surface-alt" />
          ))}
        </div>
      ) : coleccionQ.isError ? (
        <EmptyState
          icon={Sparkles}
          title="No pudimos cargar tu colección"
          description="Recarga la página en unos segundos."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {cartas.slice(0, visibles).map((carta) => (
              <CartaTile key={carta.id} carta={carta} />
            ))}
          </div>
          {visibles < cartas.length && (
            <div className="mt-8 flex justify-center">
              <Button variant="secondary" onClick={() => setVisibles((v) => v + PAGE_SIZE)}>
                Cargar más ({cartas.length - visibles})
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={Boolean(reveal)}
        onClose={() => setReveal(null)}
        titleId="reveal-cartas-title"
        panelClassName="max-w-xs text-center"
      >
        {reveal && (
          <RevealSobre
            reveal={reveal}
            puedeAbrirOtro={precio != null && reveal.saldoRestante >= precio && !abrirSobre.isPending}
            abriendo={abrirSobre.isPending}
            onAbrirOtro={abrir}
            onCerrar={() => setReveal(null)}
          />
        )}
      </Dialog>
    </Section>
  )
}

/** Reveal simple (F1): la carta aparece con un fade+scale corto. */
function RevealSobre({ reveal, puedeAbrirOtro, abriendo, onAbrirOtro, onCerrar }) {
  const { carta, nueva, saldoRestante } = reveal
  return (
    <div className="flex flex-col items-center gap-4">
      <h2 id="reveal-cartas-title" className="text-sm font-black uppercase tracking-[0.16em] text-gold">
        {nueva ? '¡Carta nueva!' : 'Repetida'}
      </h2>
      <motion.div
        key={carta.id}
        initial={{ opacity: 0, scale: 0.9, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="w-44"
      >
        <CartaTile carta={carta} eager />
      </motion.div>
      <p className="text-sm font-bold text-fg-strong">{carta.personajeNombre}</p>
      <p className="-mt-3 text-[12px] text-fg-muted">{carta.anime}</p>
      <p className="flex items-center justify-center gap-1.5 text-[12px] text-fg-muted">
        Saldo restante:
        <span className="inline-flex items-center gap-1 font-bold text-gold">
          <MonedaIcon className="h-4 w-4" /> {saldoRestante}
        </span>
      </p>
      <div className="mt-1 flex w-full flex-col gap-2">
        <Button onClick={onAbrirOtro} disabled={!puedeAbrirOtro}>
          {abriendo ? 'Abriendo…' : 'Abrir otro'}
        </Button>
        <Button variant="secondary" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
    </div>
  )
}

export default CartasPage
