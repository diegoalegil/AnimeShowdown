import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { coalescerGuardia, fechaRelativa } from './command-core';

/**
 * GuardLog — el Libro de guardia: los últimos 8 votos como asientos de tinta
 * (quién votó a quién, hace cuánto). Feed vivo con entrada por desliz (250ms,
 * command-room.css) y coalescencia de ráfagas: ≥4 votos en la misma ventana se
 * colapsan en un único asiento agregado "+N votos en la arena".
 *
 * Accesibilidad: la lista es un feed con una región aria-live="polite"
 * COALESCIDA — máximo 1 anuncio cada 8s — para no inundar al lector de
 * pantalla en una ráfaga. El anuncio se programa SOLO dentro de un timer en un
 * effect (setState legal ahí); nunca en el cuerpo del render. Cada asiento
 * individual enlaza al personaje ganador.
 *
 * `now` inyectado por el padre (sin Date.now() en render).
 *
 * @param {Object} props
 * @param {import('./command-core').Voto[]} props.votos  Feed real.
 * @param {number}  props.now        Epoch ms del reloj del padre.
 * @param {boolean} [props.dormida]  true → arena sin votos recientes (calma honesta).
 * @returns {JSX.Element}
 */
export function GuardLog({ votos, now, dormida = false }) {
  const entries = useMemo(() => coalescerGuardia(votos, { minBurst: 4, limit: 8 }), [votos]);

  const [announce, setAnnounce] = useState('');
  const lastAnnounceRef = useRef(0);
  const lastHeadRef = useRef('');

  useEffect(() => {
    const head = entries[0];
    if (!head) return undefined;
    const headKey =
      head.tipo === 'agregado'
        ? `agg-${head.fecha}-${head.n}`
        : `v-${head.fecha}-${head.voto.ganador.slug}`;
    if (headKey === lastHeadRef.current) return undefined;
    lastHeadRef.current = headKey;

    const wait = Math.max(0, 8000 - (Date.now() - lastAnnounceRef.current));
    const t = setTimeout(() => {
      lastAnnounceRef.current = Date.now();
      setAnnounce(
        head.tipo === 'agregado'
          ? `${head.n} votos llegaron a la arena.`
          : `${head.voto.username ?? 'Alguien'} votó a ${head.voto.ganador.nombre} contra ${head.voto.rival?.nombre ?? 'su rival'}.`,
      );
    }, wait);
    return () => clearTimeout(t);
  }, [entries]);

  return (
    <aside className="flex flex-col rounded-lg border border-border bg-surface p-3.5">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className="font-kanji-serif text-[16px] text-gold">
          誓
        </span>
        <h3 className="m-0 text-[13px] font-bold text-fg-strong">Libro de guardia</h3>
        <span className="ml-auto font-mono text-[10px] text-fg-muted">últimos 8</span>
      </div>

      {dormida || entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-2.5 py-6 text-center">
          <span
            aria-hidden="true"
            className="font-kanji-serif text-[56px] text-fg-muted opacity-35"
          >
            灯
          </span>
          <p className="m-0 text-sm font-semibold text-fg-strong">La arena duerme.</p>
          <p className="m-0 max-w-[220px] text-[12.5px] text-fg-muted">
            No hay votos recientes. Enciéndela: cada duelo que decidas levanta la marea.
          </p>
          <Link
            to="/votar"
            className="mt-0.5 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-accent-hover bg-accent px-[18px] text-[13px] font-bold text-fg-strong no-underline"
          >
            Encender la arena →
          </Link>
        </div>
      ) : (
        <ul aria-label="Actividad reciente de la arena" className="m-0 flex list-none flex-col gap-2 p-0">
          {entries.map((e) =>
            e.tipo === 'agregado' ? (
              <li
                key={`agg-${e.fecha}-${e.n}`}
                className="acr-guard-row flex items-start gap-2.5 rounded-lg border border-[var(--color-border-gold-subtle)] p-2.5"
                style={{ background: 'color-mix(in srgb, var(--color-gold) 7%, var(--color-bg))' }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full font-kanji-serif text-[13px] text-gold-bright"
                  style={{ background: 'color-mix(in srgb, var(--color-gold) 18%, transparent)' }}
                >
                  祭
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold leading-snug text-fg-strong">
                    +{e.n} votos en la arena{' '}
                    <span className="font-medium text-fg-muted">— ráfaga</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-fg-muted">
                    {fechaRelativa(e.fecha, now)}
                  </p>
                </div>
              </li>
            ) : (
              <GuardSeat key={`v-${e.fecha}-${e.voto.ganador.slug}`} voto={e.voto} now={now} />
            ),
          )}
        </ul>
      )}

      {/* Región viva coalescida: máx 1 anuncio / 8s. */}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </aside>
  );
}

/**
 * Asiento individual del libro de guardia. Componente auxiliar a nivel de
 * módulo (nunca anidado) para no romper react-refresh ni el React Compiler.
 * @param {{ voto: import('./command-core').Voto, now: number }} props
 */
function GuardSeat({ voto, now }) {
  const oro = false; // el padre puede pasar `oro` si el ganador es top-10; por defecto carmesí
  return (
    <li className="acr-guard-row flex items-start gap-2.5 rounded-lg border border-border bg-bg p-2.5">
      <span
        aria-hidden="true"
        className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full font-kanji-serif text-[13px]"
        style={{
          background: oro
            ? 'color-mix(in srgb, var(--color-gold) 16%, transparent)'
            : 'var(--color-accent-soft)',
          color: oro ? 'var(--color-gold)' : 'var(--color-accent-text)',
        }}
      >
        票
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] leading-snug text-fg">
          <strong className="font-bold text-fg-strong">{voto.username ?? 'Alguien'}</strong> votó a{' '}
          <Link
            to={`/personajes/${voto.ganador.slug}`}
            className="font-bold text-fg-strong no-underline hover:underline"
          >
            {voto.ganador.nombre}
          </Link>{' '}
          <span className="text-fg-muted">contra {voto.rival?.nombre ?? 'su rival'}</span>
        </div>
        <p className="mt-0.5 font-mono text-[10px] text-fg-muted">{fechaRelativa(voto.fecha, now)}</p>
      </div>
    </li>
  );
}
