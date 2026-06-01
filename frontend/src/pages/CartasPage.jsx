import { useMemo, useState } from 'react'
import { Filter, Gift, PackageOpen, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Section from '../components/Section'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Dialog from '../components/Dialog'
import CartaTile from '../components/CartaTile'
import MonedaIcon from '../components/MonedaIcon'
import PackOpening from '../features/cartas/PackOpening'
import CartasSocialPanel from '../features/cartas/CartasSocialPanel'
import { useAuth } from '../contexts/AuthContext'
import { shareOrCopy } from '../lib/share'
import { recordDailyShare } from '../lib/dailyProgress'
import {
  useAbrirSobre,
  useCofreDiario,
  useColeccion,
  useDescargarCarta,
  useOddsCartas,
} from '../hooks/useCartas'

const PAGE_SIZE = 60
const RAREZAS = ['TODAS', 'SSR', 'ESPECIAL']
const EMPTY_CARTAS = []
const EMPTY_PROGRESO = []
const numberFmt = new Intl.NumberFormat('es-ES')
const FUENTES_MONEDA = [
  'Reclama el cofre diario desde esta página.',
  'Vota cada día: el primer voto completa la misión diaria y los hitos de votos dan extras.',
  'Gana duelos live y acierta predicciones de torneos.',
  'Las cartas repetidas devuelven monedas automáticamente.',
]

function makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pack-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function CartasPage() {
  const { user } = useAuth()
  const coleccionQ = useColeccion()
  const oddsQ = useOddsCartas()
  const abrirSobre = useAbrirSobre()
  const cofreDiario = useCofreDiario()
  const descargarCarta = useDescargarCarta()

  const [visibles, setVisibles] = useState(PAGE_SIZE)
  const [reveal, setReveal] = useState(null)
  const [rarezaFiltro, setRarezaFiltro] = useState('TODAS')
  const [animeFiltro, setAnimeFiltro] = useState('TODOS')
  const [cofreResultado, setCofreResultado] = useState(null)

  const data = coleccionQ.data
  const odds = oddsQ.data
  const precio = odds?.precioSobre ?? null
  const saldo = data?.saldo ?? 0
  const totalCatalogo = data?.totalCatalogo ?? 0
  const totalPoseidas = data?.totalPoseidas ?? 0
  const porcentaje = data?.porcentaje ?? 0
  const cartas = data?.cartas ?? EMPTY_CARTAS
  const progresoPorAnime = data?.progresoPorAnime ?? EMPTY_PROGRESO
  const pityActual = data?.pityActual ?? 0
  const pityDuro = data?.pityDuro ?? odds?.pityDuro ?? 10
  const probEspecial = odds?.probabilidadEspecialBase ?? 0.05
  const puedeAbrir = precio != null && saldo >= precio && !abrirSobre.isPending
  const faltan = precio != null ? Math.max(0, precio - saldo) : null
  const cofreDisponible = Boolean(data?.cofreDiarioDisponible)
  const descargandoId = descargarCarta.isPending ? descargarCarta.variables?.id : null

  const cartasFiltradas = useMemo(() => {
    return cartas.filter((carta) => {
      const pasaRareza = rarezaFiltro === 'TODAS' || carta.rareza === rarezaFiltro
      const pasaAnime = animeFiltro === 'TODOS' || carta.anime === animeFiltro
      return pasaRareza && pasaAnime
    })
  }, [animeFiltro, cartas, rarezaFiltro])

  const resumenRarezas = useMemo(() => {
    return RAREZAS.filter((rareza) => rareza !== 'TODAS').map((rareza) => {
      const total = cartas.filter((carta) => carta.rareza === rareza).length
      const poseidas = cartas.filter((carta) => carta.rareza === rareza && carta.poseida).length
      return { rareza, total, poseidas }
    })
  }, [cartas])

  const animesDestacados = useMemo(() => {
    return [...progresoPorAnime]
      .sort((a, b) => b.total - a.total || a.anime.localeCompare(b.anime))
      .slice(0, 10)
  }, [progresoPorAnime])

  async function abrir() {
    try {
      const res = await abrirSobre.mutateAsync(makeIdempotencyKey())
      setReveal(res)
    } catch {
      // El error se muestra vía abrirSobre.isError abajo.
    }
  }

  async function reclamarCofre() {
    try {
      const res = await cofreDiario.mutateAsync()
      setCofreResultado(res)
    } catch {
      // El error se muestra vía cofreDiario.isError abajo.
    }
  }

  function descargar(carta) {
    if (!carta?.poseida) return
    descargarCarta.mutate(carta)
  }

  async function compartirCarta(carta) {
    if (!carta?.id) return
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
      toast.error('No se pudo compartir', {
        description: error?.message || 'Copia el enlace manualmente.',
      })
    }
  }

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

  return (
    <Section
      eyebrow="Cartas"
      title="Tu colección"
      description="Gana monedas jugando, abre sobres y completa el álbum con cartas normales y especiales curadas."
    >
      <div className="as-panel mb-8 flex flex-col gap-5 rounded-2xl p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Saldo" value={numberFmt.format(saldo)} icon={<MonedaIcon className="h-6 w-6 text-gold" />} />
            <Stat label="Colección" value={`${totalPoseidas} / ${totalCatalogo}`} accent={`${porcentaje}%`} />
            <Stat label="Pity especial" value={`${pityActual} / ${pityDuro}`} accent={`${Math.round(probEspecial * 100)}% base`} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button onClick={abrir} disabled={!puedeAbrir} size="lg">
              <PackageOpen className="h-5 w-5" aria-hidden="true" />
              {abrirSobre.isPending ? 'Abriendo...' : 'Abrir sobre'}
              {precio != null && (
                <span className="inline-flex items-center gap-1 font-mono">
                  {precio}
                  <MonedaIcon className="h-4 w-4" />
                </span>
              )}
            </Button>
            <Button
              variant={cofreDisponible ? 'secondary' : 'ghost'}
              onClick={reclamarCofre}
              disabled={!cofreDisponible || cofreDiario.isPending}
              size="lg"
            >
              <Gift className="h-5 w-5" aria-hidden="true" />
              {cofreDiario.isPending ? 'Reclamando...' : cofreDisponible ? 'Cofre diario' : 'Cofre reclamado'}
            </Button>
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

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.1fr_1fr_0.9fr]">
          <MonedasHelp />
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-fg-muted">
              Probabilidades visibles
            </p>
            <p className="mt-1 text-sm leading-6 text-fg">
              Cada sobre trae {odds?.normalesPorSobre ?? 4} normales y 1 clímax. Especial curada:
              {' '}
              <span className="font-black text-electric">{Math.round(probEspecial * 100)}%</span>
              {' '}base, garantizada al sobre {pityDuro} sin especial. Se gana jugando, nunca con dinero real.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-fg-muted">
              Rarezas del álbum
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {resumenRarezas.map((item) => (
                <span key={item.rareza} className="rounded-lg border border-white/10 bg-surface/70 px-2.5 py-1 text-[12px] font-bold text-fg">
                  {item.rareza}: {item.poseidas}/{item.total}
                </span>
              ))}
            </div>
          </div>
        </div>

        {!coleccionQ.isLoading && faltan != null && faltan > 0 && (
          <p className="text-[12px] text-fg-muted">
            Te faltan <span className="font-bold text-gold">{faltan}</span> monedas para abrir otro sobre.
          </p>
        )}
        {cofreResultado?.aplicado && (
          <p className="text-[12px] font-bold text-success">
            Cofre reclamado: +{cofreResultado.cantidad} monedas.
          </p>
        )}
        {abrirSobre.isError && (
          <p className="text-[12px] text-danger">No se pudo abrir el sobre. Inténtalo de nuevo.</p>
        )}
        {cofreDiario.isError && (
          <p className="text-[12px] text-danger">No se pudo reclamar el cofre diario.</p>
        )}
        {descargarCarta.isError && (
          <p className="text-[12px] text-danger">No se pudo descargar la carta. Inténtalo de nuevo.</p>
        )}
      </div>

      <CartasSocialPanel cartas={cartas} />

      <AlbumFilters
        rarezaFiltro={rarezaFiltro}
        setRarezaFiltro={setRarezaFiltro}
        animeFiltro={animeFiltro}
        setAnimeFiltro={setAnimeFiltro}
        animes={animesDestacados}
      />

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
      ) : cartasFiltradas.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No hay cartas con este filtro"
          description="Prueba con otra rareza o anime del álbum."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {cartasFiltradas.slice(0, visibles).map((carta) => (
              <CartaTile
                key={carta.id}
                carta={carta}
                onDownload={descargar}
                onShare={compartirCarta}
                downloading={descargandoId === carta.id}
              />
            ))}
          </div>
          {visibles < cartasFiltradas.length && (
            <div className="mt-8 flex justify-center">
              <Button variant="secondary" onClick={() => setVisibles((v) => v + PAGE_SIZE)}>
                Cargar más ({cartasFiltradas.length - visibles})
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={Boolean(reveal)}
        onClose={() => setReveal(null)}
        titleId="reveal-cartas-title"
        panelClassName="max-w-[56rem] p-2 sm:p-3"
      >
        {reveal && (
          <PackOpening
            key={packRevealKey(reveal)}
            reveal={reveal}
            puedeAbrirOtro={precio != null && reveal.saldoRestante >= precio && !abrirSobre.isPending}
            abriendo={abrirSobre.isPending}
            onAbrirOtro={abrir}
            onCerrar={() => setReveal(null)}
            onDownload={descargar}
            descargandoId={descargandoId}
          />
        )}
      </Dialog>
    </Section>
  )
}

function packRevealKey(reveal) {
  const cartas = Array.isArray(reveal?.cartas) ? reveal.cartas : []
  if (cartas.length > 0) {
    return cartas.map((item) => `${item.posicion}:${item.carta?.id}`).join('|')
  }
  return reveal?.carta?.id ?? 'pack'
}

function Stat({ label, value, accent, icon }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-fg-muted">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-black leading-none text-fg-strong">
        {value}
        {accent && <span className="ml-2 text-sm font-black text-gold">{accent}</span>}
      </p>
    </div>
  )
}

function MonedasHelp() {
  return (
    <section aria-labelledby="monedas-help-title" className="rounded-xl border border-gold/35 bg-gold-soft p-3">
      <div className="flex items-center gap-2">
        <MonedaIcon className="h-5 w-5 text-gold" />
        <h3 id="monedas-help-title" className="text-[11px] font-black uppercase tracking-[0.12em] text-gold">
          Cómo conseguir monedas
        </h3>
      </div>
      <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-fg">
        {FUENTES_MONEDA.map((fuente) => (
          <li key={fuente} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
            <span>{fuente}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AlbumFilters({
  rarezaFiltro,
  setRarezaFiltro,
  animeFiltro,
  setAnimeFiltro,
  animes,
}) {
  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {RAREZAS.map((rareza) => (
          <button
            key={rareza}
            type="button"
            onClick={() => setRarezaFiltro(rareza)}
            className={`rounded-lg border px-3 py-2 text-[12px] font-black uppercase tracking-wide transition ${
              rarezaFiltro === rareza
                ? 'border-gold/60 bg-gold-soft text-gold'
                : 'border-white/10 bg-surface/50 text-fg-muted hover:border-gold/50 hover:text-gold'
            }`}
          >
            {rareza === 'TODAS' ? 'Todas' : rareza}
          </button>
        ))}
      </div>
      <div className="scroll-x-fade flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setAnimeFiltro('TODOS')}
          className={`shrink-0 rounded-lg border px-3 py-2 text-[12px] font-black transition ${
            animeFiltro === 'TODOS'
              ? 'border-gold/60 bg-gold-soft text-gold'
              : 'border-white/10 bg-surface/50 text-fg-muted hover:border-gold/50 hover:text-gold'
          }`}
        >
          Todos los animes
        </button>
        {animes.map((anime) => (
          <button
            key={anime.anime}
            type="button"
            onClick={() => setAnimeFiltro(anime.anime)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-left text-[12px] font-black transition ${
              animeFiltro === anime.anime
                ? 'border-gold/60 bg-gold-soft text-gold'
                : 'border-white/10 bg-surface/50 text-fg-muted hover:border-gold/50 hover:text-gold'
            }`}
          >
            {anime.anime}
            <span className="ml-2 font-mono text-[11px] opacity-75">
              {anime.poseidas}/{anime.total}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default CartasPage
