import { useEffect, useMemo, useRef, useState } from 'react';
import './command-room.css';
import { InkDrop } from './InkDrop';
import { TideRuler } from './TideRuler';
import { GuardLog } from './GuardLog';
import {
  construirTerritorios,
  votosNuevos,
  claveVoto,
  colorGota,
} from './command-core';

// ── INTEGRACIÓN (ajusta estos imports a las rutas reales del repo) ──────────
// Arte de marca por anime (franja del territorio):
import { brandImage } from '../../../lib/brand-assets';
// Banco de sonido sintetizado + mute global (localStorage animeshowdown.muted):
// play() enruta a sfx[name] respetando el mute global; useSoundOptional es la
// variante tolerante (no-op sin provider) para que los tests aislados no rompan.
import { useSoundOptional } from '../../../contexts/SoundContext';
// ─────────────────────────────────────────────────────────────────────────────

/** Jitter determinista por slot del pool (sin Math.random en render). */
const JITTER_X = [28, 64, 46, 72, 36, 58, 50, 68, 33, 60];
const JITTER_Y = [44, 30, 66, 52, 72, 38, 58, 46, 68, 34];
const POOL = 10;

/** Pool inicial de 10 gotas inactivas (estado de reposo puro). */
function poolVacio() {
  return Array.from({ length: POOL }, (_, slot) => ({ slot, terr: null }));
}

/**
 * Sobrescribe un slot del pool (round-robin) con una gota nueva. Función PURA:
 * recibe `slot` y `born` ya resueltos por el handler del timer (donde mutar
 * refs es legal), así el updater de setDrops no muta nada y es idempotente bajo
 * la doble invocación de StrictMode / React Compiler.
 */
function estampar(prev, slot, born, { terr, casa, big }) {
  const next = prev.slice();
  next[slot] = {
    slot,
    terr,
    casa,
    big,
    x: JITTER_X[slot],
    y: JITTER_Y[slot],
    size: big ? 130 : 54 + (slot % 3) * 10,
    born,
  };
  return next;
}

/**
 * ArenaCommandRoom — la Sala de Mando: el pulso de toda la arena como MAPA DE
 * MAREAS DE TINTA. Lienzo horizontal de territorios por universo (cada anime un
 * parche con su kanji al 5% y su franja de arte real); cada voto reciente cae
 * como gota de tinta en el territorio del ganador (pool de 10 reutilizado).
 * Debajo, la regleta de mareas (TideRuler); al lado, el libro de guardia
 * (GuardLog).
 *
 * El POLLING lo gestiona el PADRE (30–60s): esta sección recibe `votos` y
 * reacciona al diff entre polls. No anima nada con la pestaña oculta o fuera de
 * viewport. NUNCA inventa actividad: cero votos → calma honesta.
 *
 * Reglas React 19 + Compiler respetadas: diff de props con guard DURANTE el
 * render (sin refs espejo en render); toda coreografía se programa en effects
 * con timers; refs se escriben solo en effects/handlers; WAAPI no se usa (todo
 * vía CSS), así que no hace falta el guard de el.animate.
 *
 * @param {Object} props
 * @param {import('./command-core').Voto[]} props.votos
 *   EXACTAMENTE el shape de /api/votos/recientes (limit 20, acotado por backend).
 * @param {import('./command-core').AnimeCatalogo[]} props.catalogo
 *   Catálogo para mapear animes→territorios (top 8 por presencia; resto al confín).
 * @param {string[]} [props.topSlugs=[]]
 *   Slugs del top-10 → sus votos caen como gota DORADA.
 * @param {Record<string,string>} [props.kanjiMap={}]
 *   Mapa slug-de-anime → glifo kanji decorativo del territorio (significado real).
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export function ArenaCommandRoom({ votos = [], catalogo = [], topSlugs = [], kanjiMap = {}, className = '' }) {
  const { muted, play } = useSoundOptional();

  // Sanea el feed en la frontera: un item sin ganador (legacy/borde del backend,
  // que tipa ganador como nullable) es ruido que reventaría claveVoto y los
  // territorios. Se descarta una sola vez aquí y alimenta a todos los consumidores.
  const votosSanos = useMemo(() => votos.filter((v) => v?.ganador?.slug), [votos]);

  const { territorios, confin } = useMemo(
    () => construirTerritorios(votosSanos, catalogo, { maxTerritorios: 8, topSlugs }),
    [votosSanos, catalogo, topSlugs],
  );
  const topSet = useMemo(() => new Set(topSlugs), [topSlugs]);
  const indexAnime = useMemo(() => {
    const m = new Map();
    territorios.forEach((t, i) => m.set(t.anime, i));
    return m;
  }, [territorios]);

  // ── reloj inyectado a los hijos (sin Date.now en render) ──────────────────
  const [now, setNow] = useState(0);
  // ── entorno: viewport + pestaña (pausan loops y goteo) ────────────────────
  const [inView, setInView] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const [entered, setEntered] = useState(false);
  // ── pool de gotas ─────────────────────────────────────────────────────────
  const [drops, setDrops] = useState(poolVacio);

  const rootRef = useRef(null);
  const slotRef = useRef(0);
  const bornRef = useRef(0);
  const clackRef = useRef(0);
  // Espejo de muted/tabHidden: los timers de la coreografía capturan sonarClack
  // por closure, así que leen estas refs para respetar el estado ACTUAL al
  // disparar (no el del poll en que se programaron).
  const mutedRef = useRef(muted);
  const tabHiddenRef = useRef(tabHidden);
  useEffect(() => {
    mutedRef.current = muted;
    tabHiddenRef.current = tabHidden;
  }, [muted, tabHidden]);

  // ── diff de feed con guard DURANTE el render (patrón a) ───────────────────
  const votosKey = useMemo(() => votosSanos.map(claveVoto).join('·'), [votosSanos]);
  const [prevKey, setPrevKey] = useState('');
  const [prevVotos, setPrevVotos] = useState([]);
  const [pending, setPending] = useState({ id: 0, votes: [] });
  if (votosKey !== prevKey) {
    const nuevos = votosNuevos(prevVotos, votosSanos);
    setPrevKey(votosKey);
    setPrevVotos(votosSanos);
    // El primer feed (montaje) NO dispara gotas: es la foto inicial, no actividad.
    if (prevKey !== '' && nuevos.length) {
      setPending((p) => ({ id: p.id + 1, votes: nuevos }));
    }
  }

  // ── sonido coalescido (máx 1 clack / 3s), respeta mute y pestaña ──────────
  const sonarClack = (timeMs) => {
    if (mutedRef.current || tabHiddenRef.current) return;
    if (timeMs - clackRef.current < 3000) return;
    clackRef.current = timeMs;
    play('playClack');
  };

  // ── coreografía de gotas: SOLO timers dentro del effect ───────────────────
  const procesadoRef = useRef(0);
  useEffect(() => {
    if (pending.id === procesadoRef.current || !pending.votes.length) return undefined;
    procesadoRef.current = pending.id;
    // Un empate no es victoria de nadie: no estampa gota (sí cuenta como
    // actividad en la regleta y el libro de guardia, que reciben votosSanos).
    const lote = pending.votes.filter((v) => !v.empate);
    if (!lote.length) return undefined;
    const burst = lote.length >= 4;
    const timers = [];

    if (burst) {
      // ráfaga = UNA gota grande en el territorio modal + clack único
      const tally = new Map();
      for (const v of lote) {
        const ti = indexAnime.get(v.ganador.anime);
        if (ti != null) tally.set(ti, (tally.get(ti) ?? 0) + 1);
      }
      let modal = 0;
      let best = -1;
      tally.forEach((c, ti) => {
        if (c > best) {
          best = c;
          modal = ti;
        }
      });
      if (best < 0) return undefined; // ráfaga 100% del confín: no estampa en el grid
      const oro = lote.some((v) => topSet.has(v.ganador.slug));
      timers.push(
        setTimeout(() => {
          const slot = slotRef.current;
          slotRef.current = (slot + 1) % POOL;
          const born = ++bornRef.current;
          setDrops((d) => estampar(d, slot, born, { terr: modal, casa: oro ? 'oro' : 'carmesi', big: true }));
          sonarClack(performance.now());
        }, 0),
      );
    } else {
      lote.forEach((v, i) => {
        const ti = indexAnime.get(v.ganador.anime);
        if (ti == null) return; // confín: cuenta pero no estampa en el grid principal
        timers.push(
          setTimeout(() => {
            const slot = slotRef.current;
            slotRef.current = (slot + 1) % POOL;
            const born = ++bornRef.current;
            setDrops((d) => estampar(d, slot, born, { terr: ti, casa: colorGota(v, topSet), big: false }));
            sonarClack(performance.now());
          }, i * 120),
        );
      });
    }
    return () => timers.forEach(clearTimeout);
    // sonarClack/topSet/indexAnime son estables o cubiertos por pending.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // ── reloj: semilla en timer (no setState síncrono en effect) + tick 30s ───
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (tabHidden || !inView) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [tabHidden, inView]);

  // ── entrada coreografiada (una vez): al asentarse, retiramos animaciones ──
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 1100);
    return () => clearTimeout(t);
  }, []);

  // ── viewport + visibilidad (pausan loops; setState en callbacks: legal) ───
  useEffect(() => {
    const el = rootRef.current;
    let io;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.01 });
      io.observe(el);
    }
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const dormida = votosSanos.length === 0;
  const maxTotal = Math.max(1, ...territorios.map((t) => t.total));
  const dropsByTerr = useMemo(() => {
    const g = new Map();
    for (const d of drops) {
      if (d.terr == null) continue;
      if (!g.has(d.terr)) g.set(d.terr, []);
      g.get(d.terr).push(d);
    }
    return g;
  }, [drops]);

  return (
    <section
      ref={rootRef}
      data-inview={inView ? 'true' : 'false'}
      data-entered={entered ? 'true' : 'false'}
      aria-labelledby="acr-title"
      className={`acr-root overflow-hidden rounded-2xl border border-border ${className}`}
      style={{
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 92%, transparent), var(--color-bg))',
      }}
    >
      <header className="flex items-center gap-3.5 border-b border-border px-5 py-[18px]">
        <span
          aria-hidden="true"
          className="font-kanji-serif text-[48px] leading-none text-gold"
          style={{ textShadow: '0 0 24px var(--color-gold-aura)' }}
        >
          戦
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="acr-title" className="m-0 text-[19px] font-extrabold tracking-tight text-fg-strong">
            La sala de mando
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            El pulso de la arena como mapa de mareas de tinta.
          </p>
        </div>
      </header>

      <div className="grid gap-[18px] p-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(248px,1fr)]">
        {/* Columna mapa */}
        <div className="flex min-w-0 flex-col gap-3.5">
          <div role="presentation" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {territorios.map((t, i) => (
              <Territory
                key={t.slug}
                t={t}
                index={i}
                kanji={kanjiMap[t.slug] ?? '界'}
                ratio={t.total / maxTotal}
                drops={dropsByTerr.get(i) ?? []}
              />
            ))}
          </div>

          <Confin confin={confin} />

          <TideRuler votos={votosSanos} now={now} />
        </div>

        {/* Columna libro de guardia */}
        <GuardLog votos={votosSanos} now={now} dormida={dormida} />
      </div>
    </section>
  );
}

/**
 * Territorio (parche de lienzo de un universo). Componente auxiliar a nivel de
 * módulo. La franja de arte usa el banco de marca real; si el slug no existe en
 * el manifest, cae a un placeholder rayado (nunca rompe).
 * @param {{ t:{anime,slug,total,casa}, index:number, kanji:string, ratio:number, drops:any[] }} props
 */
function Territory({ t, index, kanji, ratio, drops }) {
  const art = brandImage?.(`${t.slug}-scene-01`) ?? null;
  const oro = t.casa === 'oro';
  return (
    <div
      className="acr-territory relative min-h-[130px] overflow-hidden rounded-lg border p-[11px]"
      style={{
        '--acr-stagger': `${index * 60}ms`,
        borderColor:
          t.total > 0
            ? oro
              ? 'var(--color-border-gold)'
              : 'color-mix(in srgb, var(--color-accent) 42%, var(--color-border))'
            : 'var(--color-border)',
        background: 'linear-gradient(158deg, var(--color-surface-alt), var(--color-surface))',
      }}
    >
      {art ? (
        <img
          src={art.src}
          srcSet={art.srcSet}
          sizes="(max-width: 640px) 45vw, 220px"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="pointer-events-none absolute inset-x-0 top-0 h-[38px] w-full object-cover opacity-40"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[30px] opacity-70"
          style={{
            background:
              'repeating-linear-gradient(115deg, color-mix(in srgb, var(--color-fg-strong) 5%, transparent) 0 6px, transparent 6px 13px)',
          }}
        />
      )}

      <span aria-hidden="true" className="acr-kanji-watermark absolute -bottom-3.5 right-0.5 text-[92px] leading-none">
        {kanji}
      </span>

      <div
        aria-hidden="true"
        className="acr-tide-fill absolute inset-0"
        style={{
          '--acr-tide': Math.max(0.05, ratio),
          background: oro
            ? 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--color-gold) 28%, transparent))'
            : 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--color-accent) 32%, transparent))',
        }}
      />

      {drops.map((d) => (
        <InkDrop key={`${d.slot}-${d.born}`} casa={d.casa} big={d.big} xPct={d.x} yPct={d.y} sizePx={d.size} />
      ))}

      <div className="relative flex h-full flex-col justify-end gap-px">
        <span className="text-balance text-[13.5px] font-bold leading-tight text-fg-strong">{t.anime}</span>
        <span className="font-mono text-[10px] text-fg-muted">votos en la marea</span>
        {/* El estado "oro" hoy es solo cromático (borde/tinte dorados); damos una
            alternativa textual para lectores de pantalla y daltonismo. */}
        {oro && (
          <span className="sr-only">Territorio destacado: contiene a un luchador del top 10.</span>
        )}
      </div>
      <div
        className="absolute right-2.5 top-2.5 font-mono text-[19px] font-semibold"
        style={{ color: oro ? 'var(--color-gold-bright)' : 'var(--color-elo-number)' }}
      >
        {(t.total ?? 0).toLocaleString('es-ES')}
      </div>
    </div>
  );
}

/**
 * El confín — universos menores agrupados (calma agregada, sin gota propia).
 * @param {{ confin:{total:number, animes:string[]} }} props
 */
function Confin({ confin }) {
  return (
    <div
      className="relative flex min-h-[52px] items-center gap-3 overflow-hidden rounded-lg border border-dashed border-border px-3.5 py-2.5"
      style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--color-surface) 70%, transparent), transparent)' }}
    >
      <span aria-hidden="true" className="font-kanji-serif text-[30px] text-fg-muted opacity-50">
        迷
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-fg">El confín</div>
        <div className="text-[11px] text-fg-muted">
          {confin.total > 0 ? 'universos menores, agrupados' : 'aguas tranquilas'}
        </div>
      </div>
      <div className="font-mono text-[16px] font-semibold text-fg-muted">{(confin.total ?? 0).toLocaleString('es-ES')}</div>
    </div>
  );
}
