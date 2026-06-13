import { memo } from 'react'
import { AppLink } from '../../../components/AppLink'
import PersonajeImg from '../../../components/PersonajeImg'
import LiveNumber from './LiveNumber'

/**
 * FederationRow — la placa lacada del Registro de la Federación.
 *
 * Reemplaza a RankRowElo en /ranking (las pestañas de votos siguen en
 * RankRowVotos hasta parametrizar la cifra). Es un <tr> real con
 * role="row" explícito (la tabla usa display:grid por fila; los roles
 * restauran la semántica — ver federation-table.css y notas de handoff).
 *
 * Coreografía: este componente NO anima nada por sí mismo. La cinta
 * lateral ([data-fed-ribbon]) y el delta ([data-fed-delta]) son ganchos
 * que useFederationFlip (en FederationTable) enciende vía WAAPI con refs
 * — cero re-render por movimiento. El ELO usa el LiveNumber del repo.
 *
 * @param {object} props
 * @param {number}  props.rank        Puesto actual (1-based).
 * @param {object}  props.row         Item del ranking:
 *   {slug, nombre, anime, animeJp?, elo, imagenUrl?, imagenColorDominante?}.
 *   `animeJp` (título original para la furigana) NO existe hoy en el
 *   catálogo — si falta se muestra `anime`. Ver notas §Pendientes.
 * @param {boolean} props.isYou       Fila propia del usuario (borde oro + "tú").
 * @param {?number} props.stagger     Índice de stagger de la entrada de
 *   página (solo las 12 primeras filas del primer render; null = sin stagger).
 * @param {boolean} props.cv          content-visibility:auto (filas lejanas,
 *   el padre lo activa a partir de la fila ~18 con 200+ filas).
 * @param {?Function} props.renderAccion  Render-prop para la celda de acción
 *   de escritorio (por defecto el link "retar" al duelo). null = sin celda.
 */
const FederationRow = memo(function FederationRow({
  rank,
  row,
  isYou = false,
  stagger = null,
  cv = false,
  renderAccion,
}) {
  if (!row?.slug) return null
  const medal =
    rank === 1 ? 'oro' : rank === 2 ? 'plata' : rank === 3 ? 'bronce' : null
  return (
    <tr
      role="row"
      className="fed-row"
      data-flip-key={row.slug}
      data-tour="rank-row"
      data-slug={row.slug}
      data-medal={medal ?? undefined}
      data-you={isYou ? '' : undefined}
      data-stagger={stagger != null ? '' : undefined}
      data-cv={cv ? '' : undefined}
      style={stagger != null ? { '--fed-i': stagger } : undefined}
    >
      <td role="cell" className="fed-cell fed-cell-rank">
        {/* Cinta de movimiento: absolute contra el tr (position:relative).
            WAAPI la estampa 1.2s al mover la fila. */}
        <span className="fed-ribbon" data-fed-ribbon="" aria-hidden="true"></span>
        <span className="fed-rank">{String(rank).padStart(2, '0')}</span>
        {/* Delta "+2": espacio SIEMPRE reservado (min-width) — cero CLS. */}
        <span className="fed-delta" data-fed-delta="" aria-hidden="true"></span>
      </td>
      <td role="cell" className="fed-cell">
        <PersonajeImg
          slug={row.slug}
          src={row.imagenUrl}
          nombre={row.nombre}
          colorDominante={row.imagenColorDominante}
          alt=""
          loading="lazy"
          sizes="36px"
          className="fed-portrait"
        />
      </td>
      <td role="cell" className="fed-cell fed-cell-id">
        <span className="fed-furigana" lang="ja" title={row.anime}>
          {row.animeJp ?? row.anime}
        </span>
        <span className="fed-name">
          <AppLink
            to={`/personajes/${row.slug}`}
            aria-label={`Puesto ${rank} — ${row.nombre} de ${row.anime}, ELO ${row.elo}`}
            title={`${row.nombre} de ${row.anime}`}
          >
            {row.nombre}
          </AppLink>
          {isYou && <span className="fed-you-chip">tú</span>}
        </span>
      </td>
      <td role="cell" className="fed-cell fed-cell-action">
        {renderAccion ? (
          renderAccion(row)
        ) : (
          <AppLink
            to={`/votar?personaje=${encodeURIComponent(row.slug)}`}
            aria-label={`Retar a ${row.nombre} en un duelo`}
            className="fed-action"
          >
            retar
          </AppLink>
        )}
      </td>
      <td role="cell" className="fed-cell fed-cell-elo">
        <span className="fed-elo">
          {/* Odómetro del repo tal cual — NO reescrito. Su live-burst-gate
              ya corta el roll en cambios masivos (>12 por ciclo). */}
          <LiveNumber value={row.elo} />
        </span>
        <span className="fed-elo-label">elo</span>
      </td>
    </tr>
  )
})

/**
 * FederationRowSkeleton — piel .skl en silueta de placa (misma rejilla,
 * misma altura: cero CLS al hidratar).
 */
export function FederationRowSkeleton() {
  return (
    <tr role="row" className="fed-row fed-skl-row skl" aria-hidden="true">
      <td role="cell" className="fed-cell fed-cell-rank">
        <span className="fed-skl-block fed-skl-rank"></span>
      </td>
      <td role="cell" className="fed-cell">
        <span className="fed-skl-block fed-skl-portrait"></span>
      </td>
      <td role="cell" className="fed-cell fed-cell-id">
        <span className="fed-skl-block fed-skl-line"></span>
        <span className="fed-skl-block fed-skl-line"></span>
      </td>
      <td role="cell" className="fed-cell fed-cell-action"></td>
      <td role="cell" className="fed-cell fed-cell-elo">
        <span className="fed-skl-block fed-skl-elo"></span>
      </td>
    </tr>
  )
}

export default FederationRow
