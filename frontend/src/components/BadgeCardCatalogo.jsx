import { Check, Lock, Users } from 'lucide-react'
import { iconoDeBadge } from '../lib/badgeIcons'
import { kanjiDeBadge } from '../lib/badgeKanji'

/**
 * Card de badge para la página /logros.
 *
 * Diferencias con {@link BadgeCard} (el del perfil):
 *   - Más grande y con descripción visible por default (no en tooltip).
 *   - Muestra stats comunidad: "X usuarios lo tienen (Y%)".
 *   - Si el usuario está logueado y lo tiene desbloqueado, marca con check
 *     y borde accent. Si no, sigue mostrando todo el contenido (no oculta
 *     la pista de "cómo conseguirlo").
 *   - Sin animaciones expandibles — toda la info ya está visible.
 */

const RAREZA_STYLE = {
  1: {
    nombre: 'Común',
    borde: 'border-rarity-common/40',
    glow: '',
    icono: 'text-rarity-common',
    chip: 'bg-rarity-common/10 text-rarity-common border-rarity-common/40',
    kanjiBg: 'bg-rarity-common/15',
  },
  2: {
    nombre: 'Poco común',
    borde: 'border-rarity-uncommon/50',
    glow: 'shadow-aura-sm [--aura-color:rgb(16_185_129_/_0.5)]',
    icono: 'text-rarity-uncommon',
    chip: 'bg-rarity-uncommon/10 text-rarity-uncommon border-rarity-uncommon/40',
    kanjiBg: 'bg-rarity-uncommon/15',
  },
  3: {
    nombre: 'Raro',
    borde: 'border-rarity-rare/50',
    glow: 'shadow-aura-sm [--aura-color:rgb(56_189_248_/_0.55)]',
    icono: 'text-rarity-rare',
    chip: 'bg-rarity-rare/10 text-rarity-rare border-rarity-rare/40',
    kanjiBg: 'bg-rarity-rare/15',
  },
  4: {
    nombre: 'Épico',
    borde: 'border-rarity-epic/55',
    glow: 'shadow-aura-sm [--aura-color:rgb(168_85_247_/_0.6)]',
    icono: 'text-rarity-epic',
    chip: 'bg-rarity-epic/10 text-rarity-epic border-rarity-epic/40',
    kanjiBg: 'bg-rarity-epic/15',
  },
  5: {
    nombre: 'Legendario',
    borde: 'border-rarity-legendary/60',
    glow: 'shadow-aura [--aura-color:rgb(251_191_36_/_0.7)] animate-pulse-halo',
    icono: 'text-rarity-legendary',
    chip: 'bg-rarity-legendary/15 text-rarity-legendary border-rarity-legendary/40',
    kanjiBg: 'bg-rarity-legendary/15',
  },
}

function getIcon(nombre) {
  return iconoDeBadge(nombre)
}

function formatFecha(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function BadgeCardCatalogo({ logro, count = 0, totalUsuarios = 0, destacado = false }) {
  const desbloqueado = Boolean(logro.desbloqueadoEn)
  const style = RAREZA_STYLE[logro.rareza] ?? RAREZA_STYLE[1]
  const Icon = getIcon(logro.icono)
  const kanji = kanjiDeBadge(logro.codigo)
  const porcentaje =
    totalUsuarios > 0 ? Math.round((count / totalUsuarios) * 100) : null

  return (
    <article
      id={`logro-${logro.codigo}`}
      className={`relative flex h-full flex-col gap-4 rounded-xl border ${
        desbloqueado ? style.borde : 'border-border'
      } ${
        desbloqueado ? `bg-surface ${style.glow}` : 'bg-surface/60'
      } scroll-mt-28 p-5 transition-all ${
        destacado
          ? 'ring-2 ring-rarity-legendary/80 shadow-aura [--aura-color:rgb(251_191_36_/_0.9)]'
          : ''
      }`}
      itemScope
      itemType="https://schema.org/Achievement"
    >
      {desbloqueado && (
        <span
          aria-label="Desbloqueado"
          className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent bg-bg"
        >
          <Check className="h-4 w-4 text-gold" />
        </span>
      )}

      <header className="flex items-start gap-4">
        <span
          className={`relative inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${
            desbloqueado ? 'bg-bg' : 'bg-bg/40'
          }`}
        >
          {/* eslint-disable-next-line react-hooks/static-components -- icon
              es lookup dinámico por logro.icono; el componente sí es estable
              entre renders del mismo badge (mismo logro = mismo icono). */}
          <Icon
            className={`h-8 w-8 ${desbloqueado ? style.icono : 'text-fg-muted/40'}`}
          />
          {!desbloqueado && (
            <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/55">
              <Lock className="h-5 w-5 text-fg-muted" />
            </span>
          )}
          {kanji && (
            <span
              aria-hidden="true"
              lang="ja"
              className={`font-jp absolute -right-1.5 -top-1.5 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-border ${style.kanjiBg} px-1 text-[12px] leading-none ${style.icono}`}
            >
              {kanji}
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span
            className={`inline-flex w-fit rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.chip}`}
          >
            {style.nombre}
          </span>
          <h3
            itemProp="name"
            className={`text-base font-bold leading-tight ${
              desbloqueado ? 'text-fg-strong' : 'text-fg/80'
            }`}
          >
            {logro.nombre}
          </h3>
        </div>
      </header>

      <p
        itemProp="description"
        className="text-[13px] leading-relaxed text-fg-muted"
      >
        {logro.descripcion}
      </p>

      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-fg-muted">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Users className="h-3 w-3" />
          <strong className="font-semibold text-fg-strong">{count}</strong>
          {totalUsuarios > 0 && (
            <span>· {porcentaje}% de la comunidad</span>
          )}
        </span>
        {desbloqueado && (
          <span className="text-fg-muted/80">
            {formatFecha(logro.desbloqueadoEn)}
          </span>
        )}
      </footer>
    </article>
  )
}

export default BadgeCardCatalogo
