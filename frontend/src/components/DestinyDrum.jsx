import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import PersonajeImg from './PersonajeImg';
import { useSound } from '../contexts/SoundContext';
import './destiny-drum.css';

/* ============================================================
   DestinyDrum — La ruleta del destino (/games/ruleta)
   Tambor vertical de festival: los retratos pasan como en una
   linterna giratoria y el elegido aterriza EXACTO bajo el visor.

   CONTRATO ANTI-TRAMPA (documentado en NOTAS-HANDOFF):
   - La selección aleatoria la hace el MOTOR de la página, ANTES
     de girar. Este componente jamás re-sortea: la física garantiza
     que `resultado.slug` es el que cae bajo el visor.
   - Flujo: botón → onPedirGiro() → el motor decide → la página
     sube `resultado={slug, spinId}` con un spinId NUEVO → el
     tambor coreografía hacia ese slug.
   ============================================================ */

const ITEM_H = 188;          // alto de celda px — debe coincidir con --dd-item-h del css
const COPIAS = 3;            // el carrete se renderiza 3× para el wrap infinito
const ACCEL_MS = 300;        // aceleración (½at², continuidad con el crucero)
const CRUISE_MS = 900;       // crucero a velocidad constante (scaleY 1.02, sin blur)
const DECEL_MS = 1400;       // freno easeOut cúbico con continuidad de velocidad
const INK_MS = 150;          // corte de tinta tras el asiento
const SELLO_MS = 480;        // sello hanko + CTAs
const COOLDOWN_MS = 300;     // anti doble-click tras asentar
const RACHA_CALIENTE = 3;    // giros seguidos para "calentar" el tambor
const VUELTAS_MIN = 4;       // vueltas mínimas de espectáculo
const TICK_GAP_MS = 45;      // rate-limit de playClack por cruce de slot

// prefers-reduced-motion vía useSyncExternalStore (lectura pura en render)
const rmSub = (cb) => {
  const q = window.matchMedia('(prefers-reduced-motion: reduce)');
  q.addEventListener('change', cb);
  return () => q.removeEventListener('change', cb);
};
const rmGet = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rmServer = () => false;

/**
 * Aplica la posición del carrete. SOLO se llama desde effects/rAF
 * (cero estado por frame: transforms por ref en UN rAF).
 * Visor centrado = celda i bajo el visor cuando y ≡ i·ITEM_H (mod LOOP).
 */
function aplicarCarrete(carrete, stretch, y, sy, n) {
  if (!carrete || !stretch) return;
  const loop = n * ITEM_H;
  let m = y % loop;
  if (m < 0) m += loop;
  carrete.style.transform = `translate3d(0, ${ITEM_H - m - loop}px, 0)`;
  stretch.style.transform = sy === 1 ? 'none' : `scaleY(${sy})`;
}

/** Celda del carrete (nivel de módulo: requisito react-refresh). */
function CeldaRetrato({ personaje, eager }) {
  return (
    <div className="dd-celda">
      <PersonajeImg
        slug={personaje.slug}
        colorDominante={personaje.colorDominante ?? personaje.imagenColorDominante}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        sizes="120px"
        fit="cover"
        className="dd-retrato"
      />
    </div>
  );
}

/**
 * La ruleta del destino — tambor vertical de personaje aleatorio.
 *
 * @param {Object} props
 * @param {Array<{slug: string, nombre: string, anime: string, colorDominante?: string}>} props.roster
 *   Roster ACTIVO (la página ya lo filtra por universo). Identidad estable
 *   durante un giro (memoizar upstream): cambiarlo a mitad cancela la coreografía.
 * @param {{slug: string, spinId: number}|null} props.resultado
 *   Resultado decidido por el MOTOR antes de girar. Un spinId nuevo dispara el giro.
 * @param {() => void} props.onPedirGiro
 *   El botón gigante pide giro; la página consulta al motor y sube `resultado`.
 * @param {(personaje: Object) => void} [props.onAsentado]
 *   Se dispara en el golpe de asiento (el elegido ya está bajo el visor).
 * @param {(personaje: Object) => void} [props.onVerFicha]
 *   CTA «Ver ficha» — punto de enganche para el morph personaje-hero (viewTransitions).
 * @param {(personaje: Object) => void} [props.onVotar]
 *   CTA «Votar con {nombre}».
 * @param {string|null} [props.filtroUniverso]
 *   Etiqueta del universo activo (solo display, chip 界). El filtrado real es del roster.
 * @param {string} [props.className]
 */
export default function DestinyDrum({
  roster,
  resultado = null,
  onPedirGiro,
  onAsentado,
  onVerFicha,
  onVotar,
  filtroUniverso = null,
  className = '',
}) {
  // El SoundContext del repo expone `play(name)`; lo envolvemos en la forma de
  // "players nombrados" que el tambor espera (playWhoosh/playClack/…). El mute
  // global ya vive dentro de `play`. useMemo: identidad estable por render.
  const { play } = useSound();
  const sounds = useMemo(
    () => ({
      playWhoosh: () => play('playWhoosh'),
      playClack: () => play('playClack'),
      playSello: () => play('playSello'),
      playStreakHito: () => play('playStreakHito'),
      playAcunado: () => play('playAcunado'),
    }),
    [play],
  );
  const soundsRef = useRef(null);
  useEffect(() => { soundsRef.current = sounds; }); // espejo en effect (nunca en render)

  const reduceMotion = useSyncExternalStore(rmSub, rmGet, rmServer);

  const [fase, setFase] = useState('idle'); // idle | girando | asentado | corte | reveal
  const [elegido, setElegido] = useState(null);
  const [cooldown, setCooldown] = useState(false);
  const [racha, setRacha] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [pendiente, setPendiente] = useState(null);
  const [prevSpinId, setPrevSpinId] = useState(null);

  // Ajuste derivado DURANTE el render con guard (patrón canónico React 19):
  // un spinId nuevo arma la coreografía como ESTADO PENDIENTE.
  if (resultado && resultado.spinId !== prevSpinId) {
    setPrevSpinId(resultado.spinId);
    setPendiente(resultado);
    setFase('girando');
    setElegido(null);
    setAnnounce('');
  }

  const ventanaRef = useRef(null);
  const stretchRef = useRef(null);
  const carreteRef = useRef(null);
  const yRef = useRef(0);
  const hechoRef = useRef(null); // spinId ya coreografiado (evita re-giro si cambian deps)

  // Posición inicial + reset al cambiar el roster (filtro de universo)
  useEffect(() => {
    yRef.current = 0;
    aplicarCarrete(carreteRef.current, stretchRef.current, 0, 1, roster.length);
  }, [roster]);

  // Sonido de hito de racha (side-effect legal en cuerpo de effect: no es setState)
  useEffect(() => {
    if (racha === RACHA_CALIENTE) soundsRef.current?.playStreakHito?.();
  }, [racha]);

  // Coreografía: SOLO timers/rAF; todo setState ocurre dentro de callbacks.
  useEffect(() => {
    if (!pendiente || pendiente.spinId === hechoRef.current) return;
    const idx = roster.findIndex((p) => p.slug === pendiente.slug);
    if (idx < 0) return; // contrato roto: el slug debe pertenecer al roster activo (ver notas)

    const n = roster.length;
    const loop = n * ITEM_H;
    let raf = 0;
    const timers = [];
    const t = (fn, ms) => timers.push(setTimeout(fn, ms));
    const snd = (name) => soundsRef.current?.[name]?.();

    const asentar = () => {
      hechoRef.current = pendiente.spinId;
      setFase('asentado');
      setElegido(roster[idx]);
      setCooldown(true);
      // golpe de asiento: playAcunado si se adopta; playClack como fallback canónico
      const s = soundsRef.current;
      (s?.playAcunado || s?.playClack)?.();
      onAsentado?.(roster[idx]);
      t(() => {
        setFase('corte');
        setAnnounce(`El destino eligió a ${roster[idx].nombre}, de ${roster[idx].anime}.`);
      }, INK_MS);
      t(() => { setFase('reveal'); snd('playSello'); }, SELLO_MS);
      t(() => { setCooldown(false); setRacha((r) => r + 1); }, COOLDOWN_MS);
    };

    let y0 = yRef.current % loop;
    if (y0 < 0) y0 += loop;
    yRef.current = y0;

    if (reduceMotion) {
      // Sin giro: cross-fade directo al elegido (400 ms total), mismo announce.
      const el = ventanaRef.current;
      el?.classList.add('dd-fundido');
      t(() => {
        yRef.current = idx * ITEM_H;
        aplicarCarrete(carreteRef.current, stretchRef.current, yRef.current, 1, n);
        el?.classList.remove('dd-fundido');
        t(asentar, 200);
      }, 200);
    } else {
      let delta = (idx * ITEM_H - y0) % loop;
      if (delta <= 0) delta += loop;
      const k = Math.max(VUELTAS_MIN, Math.ceil((2600 - delta) / loop));
      const d = delta + k * loop; // aterrizaje EXACTO: (y0 + d) mod loop = idx·ITEM_H
      const v = d / (ACCEL_MS / 2 + CRUISE_MS + DECEL_MS / 3); // velocidad de crucero con continuidad en el freno
      const dAccel = (v * ACCEL_MS) / 2;
      const dCruise = v * CRUISE_MS;
      const dDecel = (v * DECEL_MS) / 3;
      let lastSlot = Math.floor(y0 / ITEM_H);
      let lastTick = 0;
      snd('playWhoosh');
      const start = performance.now();
      const frame = (now) => {
        const tt = now - start;
        let y;
        let sy;
        if (tt < ACCEL_MS) {
          y = y0 + (v * tt * tt) / (2 * ACCEL_MS);
          sy = 1 + 0.02 * (tt / ACCEL_MS);
        } else if (tt < ACCEL_MS + CRUISE_MS) {
          y = y0 + dAccel + v * (tt - ACCEL_MS);
          sy = 1.02;
        } else if (tt < ACCEL_MS + CRUISE_MS + DECEL_MS) {
          const p = (tt - ACCEL_MS - CRUISE_MS) / DECEL_MS;
          y = y0 + dAccel + dCruise + dDecel * (1 - (1 - p) ** 3);
          sy = 1 + 0.02 * (1 - p) ** 2;
        } else {
          yRef.current = y0 + d;
          aplicarCarrete(carreteRef.current, stretchRef.current, yRef.current, 1, n);
          asentar();
          return;
        }
        yRef.current = y;
        aplicarCarrete(carreteRef.current, stretchRef.current, y, sy, n);
        const slot = Math.floor(y / ITEM_H);
        if (slot !== lastSlot && now - lastTick > TICK_GAP_MS) {
          lastSlot = slot;
          lastTick = now;
          snd('playClack');
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [pendiente, roster, reduceMotion, onAsentado]);

  const ocupado = fase === 'girando' || cooldown;
  const caliente = racha >= RACHA_CALIENTE;

  const celdas = [];
  for (let c = 0; c < COPIAS; c += 1) {
    roster.forEach((p, i) => {
      // eager: copia central, roster visible + vecinos (variantes -300 las resuelve PersonajeImg)
      celdas.push(<CeldaRetrato key={`${c}-${p.slug}`} personaje={p} eager={c === 1 && i <= 2} />);
    });
  }

  return (
    <section
      className={`dd-root ${className}`}
      data-fase={fase}
      data-heat={caliente ? 'true' : 'false'}
    >
      {filtroUniverso ? (
        <p className="dd-filtro font-mono">
          <span className="dd-kanji" aria-hidden="true">界</span> {filtroUniverso}
        </p>
      ) : null}

      <div className="dd-tambor" aria-hidden="true">
        <div className="dd-ventana" ref={ventanaRef}>
          <div className="dd-stretch" ref={stretchRef}>
            <div className="dd-carrete" ref={carreteRef}>{celdas}</div>
          </div>
          <span className="dd-scrim dd-scrim-top" />
          <span className="dd-scrim dd-scrim-bot" />
        </div>
        <span className="dd-visor" />
        <span className="dd-marca dd-marca-izq" />
        <span className="dd-marca dd-marca-der" />
        <span className="dd-hairline dd-hairline-izq" />
        <span className="dd-hairline dd-hairline-der" />
      </div>

      <button
        type="button"
        className="dd-btn-girar"
        disabled={ocupado}
        onClick={onPedirGiro}
      >
        {fase === 'girando' ? 'Girando…' : 'Girar el destino'}
      </button>

      <div className="dd-resultado" data-visible={elegido ? 'true' : 'false'}>
        {elegido ? (
          <>
            <p className="dd-eyebrow font-mono">— el destino eligió —</p>
            <div className="dd-nombre">
              <h2 className="dd-nombre-texto">{elegido.nombre}</h2>
              <span className="dd-corte-cover" aria-hidden="true" />
            </div>
            <div className="dd-firma">
              <span className="dd-hanko" aria-hidden="true">印</span>
              <p className="dd-anime font-mono">{elegido.anime}</p>
            </div>
            <div className="dd-ctas">
              <button type="button" className="dd-btn-votar" onClick={() => onVotar?.(elegido)}>
                Votar con {elegido.nombre}
              </button>
              <button type="button" className="dd-btn-ficha" onClick={() => onVerFicha?.(elegido)}>
                Ver ficha
              </button>
            </div>
          </>
        ) : null}
      </div>

      <p className="dd-announce" role="status" aria-live="polite">{announce}</p>
    </section>
  );
}
