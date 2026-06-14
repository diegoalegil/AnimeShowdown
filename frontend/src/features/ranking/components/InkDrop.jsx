import { memo } from 'react';

/**
 * InkDrop — una gota de tinta del mapa de mareas. Presentacional puro: la
 * posición, tamaño y casa los decide el pool en ArenaCommandRoom. El bloom
 * (scale 0.2→1 + asentamiento) y la aparición seca en reduced-motion los
 * resuelve command-room.css; aquí solo entra la geometría dinámica como
 * inline-style (las únicas props que no pueden vivir en la hoja de feature).
 *
 * Pool de 10 nodos REUTILIZADO: el padre monta exactamente 10 InkDrop y va
 * sobreescribiendo slots en round-robin; cada gota nueva cambia su `key` para
 * relanzar el bloom sin crear nodos extra.
 *
 * @param {Object} props
 * @param {'carmesi'|'oro'} [props.casa='carmesi'] Carmesí = victoria local; oro = top-10.
 * @param {boolean} [props.big=false]              Gota grande de ráfaga coalescida.
 * @param {number}  props.xPct                     Centro X dentro del territorio (0–100).
 * @param {number}  props.yPct                     Centro Y dentro del territorio (0–100).
 * @param {number}  props.sizePx                   Diámetro en px.
 * @returns {JSX.Element}
 */
export const InkDrop = memo(function InkDrop({ casa = 'carmesi', big = false, xPct, yPct, sizePx }) {
  return (
    <span
      className="acr-ink"
      aria-hidden="true"
      data-casa={casa}
      data-big={big || undefined}
      style={{ left: `${xPct}%`, top: `${yPct}%`, width: sizePx, height: sizePx }}
    />
  );
});
