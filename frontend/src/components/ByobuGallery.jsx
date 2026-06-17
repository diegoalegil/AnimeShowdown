import { useEffect, useRef, useState } from 'react';
import { useSoundOptional } from '../contexts/SoundContext';
import './byobu-gallery.css';

/* Tiempos exactos de la coreografía (ver notas de handoff). */
const OPEN_MS = 260;     // despliegue del visor — ease-lift
const CLOSE_MS = 230;    // plegado inverso — ease-brush
const FOLD_OUT_MS = 200; // lámina saliente — ease-brush
const FOLD_IN_MS = 240;  // lámina entrante — ease-lift
const SWIPE_PX = 48;     // umbral de swipe en táctil

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Panel en papel para lámina rota — aviso honesto, sin retry falso.
 * @param {object} props
 * @param {number} props.ordinal - número de lámina (1-based), solo para el SR.
 * @param {boolean} [props.mini] - variante compacta para la miniatura.
 */
function PaperLeaf({ ordinal, mini }) {
  return (
    <div className={'byobu-paper' + (mini ? ' byobu-paper--mini' : '')}>
      <span className="byobu-paper__kanji" aria-hidden="true">空</span>
      {!mini && (
        <div className="byobu-paper__text">
          <p className="byobu-paper__note">Esta lámina no se pudo cargar.</p>
          <p className="byobu-paper__sub">el origen bloqueó el enlace o la imagen ya no existe</p>
        </div>
      )}
      <span className="byobu-sr">Lámina {ordinal} no disponible</span>
    </div>
  );
}

/**
 * Tira esqueleto para los estados cargando / invitado.
 * @param {object} props
 * @param {number} props.count - nº de paneles fantasma.
 * @param {string} props.note - texto bajo la tira (role=status).
 */
function SkeletonStrip({ count, note }) {
  return (
    <div className="byobu-stripwrap">
      <ul className="byobu-strip" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="byobu-thumb-item">
            <span className="byobu-thumb byobu-skel"></span>
          </li>
        ))}
      </ul>
      <p className="byobu-strip__note" role="status">{note}</p>
    </div>
  );
}

/**
 * ByobuGallery — galería de imágenes extra (Jikan/MAL) como biombo de láminas.
 *
 * Tira horizontal de miniaturas 2:3 con marcos finos; al abrir, visor a pantalla
 * (role=dialog, aria-modal, foco atrapado y restaurado) con navegación por
 * bisagras, teclado y swipe. Hotlink-protection: referrerPolicy="no-referrer"
 * en miniaturas, visor y prefetch; si una lámina falla, panel en papel.
 *
 * Sonido: playWhoosh (abrir/cerrar) y playClack (navegar) de lib/sounds,
 * disparados vía SoundContext.play() (useSoundOptional) para respetar el mute
 * global; fuera del provider el play() es no-op y no truena.
 *
 * @param {object} props
 * @param {Array<{url: string, alt?: string}>} props.images
 *   Láminas en orden. Desde Jikan: pictures.map(p => ({ url: p.jpg.image_url })).
 * @param {string} props.title
 *   Nombre del personaje — se usa en aria-label y como alt de respaldo.
 * @param {'ready'|'loading'|'guest'} [props.status='ready']
 *   'loading' y 'guest' pintan la tira esqueleto (el pulso se pausa con
 *   html.as-calm / html.as-tab-hidden / prefers-reduced-motion).
 * @param {string} [props.guestLabel]
 *   Copy del estado invitado. PENDIENTE de producto: el default es placeholder
 *   documentado, no copy final (ver notas de handoff).
 * @param {number} [props.skeletonCount=5]
 *   Paneles fantasma de la tira esqueleto.
 */
export default function ByobuGallery({
  images = [],
  title = '',
  status = 'ready',
  guestLabel = 'La galería se abre al iniciar sesión.',
  skeletonCount = 5,
}) {
  const { play } = useSoundOptional();
  const [view, setView] = useState(null); // { index, ox, oy } | null
  const [anim, setAnim] = useState({ phase: 'closed', dir: 0, next: 0 });
  const [failed, setFailed] = useState({}); // url -> true
  const [loaded, setLoaded] = useState({}); // url -> true

  const triggerRef = useRef(null);   // thumbnail de origen (restore focus)
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const leafRef = useRef(null);      // figure actual (drag de swipe)
  const prefetched = useRef(new Set());
  const touchRef = useRef(null);

  const n = images.length;
  const isOpen = view !== null;
  const current = view ? images[view.index] : null;
  const openIndex = view ? view.index : -1;

  /* ——— handlers ——— */

  function markFailed(url) {
    setFailed((f) => (f[url] ? f : { ...f, [url]: true }));
  }
  function markLoaded(url) {
    setLoaded((l) => (l[url] ? l : { ...l, [url]: true }));
  }

  function openAt(i, ev) {
    if (status !== 'ready' || n === 0 || isOpen) return;
    const btn = ev.currentTarget;
    triggerRef.current = btn;
    const r = btn.getBoundingClientRect();
    play('playWhoosh');
    setView({ index: i, ox: Math.round(r.left + r.width / 2), oy: Math.round(r.top + r.height / 2) });
    setAnim({ phase: 'opening', dir: 0, next: i });
  }

  function close() {
    play('playWhoosh');
    setAnim((a) => (a.phase === 'closing' ? a : { ...a, phase: 'closing' }));
  }

  function nav(dir) {
    if (!view || anim.phase !== 'idle') return;
    const next = view.index + dir;
    if (next < 0 || next >= n) return;
    play('playClack');
    setAnim({ phase: 'out', dir, next });
  }

  function onDialogKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); nav(1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); nav(-1); return; }
    if (e.key !== 'Tab') return;
    /* Trap de foco propio (~15 líneas). Si AccessibleDialog de la casa encaja,
       sustituir el wrapper .byobu-unfold por él y borrar este bloque. */
    const root = dialogRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* Swipe táctil: touch-action pan-y en .byobu-stage evita el scroll-fight;
     el arrastre escribe transform vía ref (nunca estado >1×/frame). */
  function onTouchStart(e) {
    if (!view || anim.phase !== 'idle' || n < 2) return;
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, dx: 0, horiz: null };
  }
  function onTouchMove(e) {
    const s = touchRef.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.horiz === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      s.horiz = Math.abs(dx) > Math.abs(dy);
    }
    if (!s.horiz) return;
    s.dx = dx;
    const el = leafRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.transform = 'translateX(' + dx * 0.35 + 'px)';
      el.style.opacity = String(Math.max(0.55, 1 - Math.abs(dx) / 600));
    }
  }
  function onTouchEnd() {
    const s = touchRef.current;
    touchRef.current = null;
    const el = leafRef.current;
    if (el) {
      el.style.transition = 'transform 160ms var(--ease-lift), opacity 160ms var(--ease-lift)';
      el.style.transform = '';
      el.style.opacity = '';
    }
    if (!s || !s.horiz) return;
    if (s.dx <= -SWIPE_PX) nav(1);
    else if (s.dx >= SWIPE_PX) nav(-1);
  }

  /* ——— máquina de fases: estado pendiente en render, timers en effects ——— */
  useEffect(() => {
    if (!isOpen) return undefined;
    if (anim.phase === 'opening') {
      const t = setTimeout(() => { setAnim((a) => ({ ...a, phase: 'idle' })); }, OPEN_MS);
      return () => clearTimeout(t);
    }
    if (anim.phase === 'out') {
      const t = setTimeout(() => {
        setView((v) => (v ? { ...v, index: anim.next } : v));
        setAnim((a) => ({ ...a, phase: 'in' }));
      }, FOLD_OUT_MS);
      return () => clearTimeout(t);
    }
    if (anim.phase === 'in') {
      const t = setTimeout(() => { setAnim((a) => ({ ...a, phase: 'idle' })); }, FOLD_IN_MS);
      return () => clearTimeout(t);
    }
    if (anim.phase === 'closing') {
      const t = setTimeout(() => {
        setView(null);
        setAnim({ phase: 'closed', dir: 0, next: 0 });
        const trigger = triggerRef.current;
        if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
      }, CLOSE_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [anim, isOpen]);

  /* Foco inicial al abrir (timer ⇒ legal). */
  useEffect(() => {
    if (!isOpen) return undefined;
    const t = setTimeout(() => {
      const el = closeBtnRef.current;
      if (el) el.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  /* Bloqueo de scroll con compensación de scrollbar ⇒ cero layout shift. */
  useEffect(() => {
    if (!isOpen) return undefined;
    const body = document.body;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = gap + 'px';
    return () => { body.style.overflow = prevOverflow; body.style.paddingRight = prevPad; };
  }, [isOpen]);

  /* Prefetch SOLO adyacentes (actual eager, resto nada). */
  useEffect(() => {
    if (openIndex < 0) return;
    for (const i of [openIndex - 1, openIndex + 1]) {
      if (i < 0 || i >= images.length) continue;
      const url = images[i] && images[i].url;
      if (!url || prefetched.current.has(url)) continue;
      prefetched.current.add(url);
      const im = new Image();
      im.referrerPolicy = 'no-referrer';
      im.decoding = 'async';
      im.src = url;
    }
  }, [openIndex, images]);

  /* ——— estados sin datos ——— */
  if (status === 'loading' || status === 'guest') {
    return (
      <div className="byobu">
        <SkeletonStrip
          count={skeletonCount}
          note={status === 'guest' ? guestLabel : 'cargando láminas…'}
        />
      </div>
    );
  }
  if (n === 0) return null; // sin láminas extra: la ficha no pinta la sección

  /* ——— clases de animación ——— */
  let overlayCls = 'byobu-overlay';
  if (anim.phase === 'opening') overlayCls += ' byobu-overlay--opening';
  if (anim.phase === 'closing') overlayCls += ' byobu-overlay--closing';

  let leafCls = 'byobu-leaf';
  if (anim.phase === 'out') leafCls += anim.dir > 0 ? ' byobu-leaf--out-next' : ' byobu-leaf--out-prev';
  if (anim.phase === 'in') leafCls += anim.dir > 0 ? ' byobu-leaf--in-next' : ' byobu-leaf--in-prev';

  const atStart = view ? view.index === 0 : true;
  const atEnd = view ? view.index === n - 1 : true;

  return (
    <div className="byobu">
      <ul className="byobu-strip" aria-label={'Galería de ' + title + ' — ' + n + (n === 1 ? ' lámina' : ' láminas')}>
        {images.map((img, i) => (
          <li key={img.url || i} className="byobu-thumb-item">
            <button
              type="button"
              className="byobu-thumb"
              aria-haspopup="dialog"
              aria-label={'Abrir lámina ' + (i + 1) + ' de ' + n + (failed[img.url] ? ' — no disponible' : '')}
              onClick={(e) => openAt(i, e)}
            >
              {failed[img.url] ? (
                <PaperLeaf ordinal={i + 1} mini />
              ) : (
                <img
                  src={img.url}
                  alt={img.alt || 'Lámina ' + (i + 1) + ' de ' + title}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onLoad={() => markLoaded(img.url)}
                  onError={() => markFailed(img.url)}
                />
              )}
            </button>
          </li>
        ))}
      </ul>

      {isOpen && (
        <div className={overlayCls}>
          <div
            className="byobu-unfold"
            role="dialog"
            aria-modal="true"
            aria-label={'Galería de ' + title + ' — lámina ' + (view.index + 1) + ' de ' + n}
            ref={dialogRef}
            style={{ '--byobu-ox': view.ox + 'px', '--byobu-oy': view.oy + 'px' }}
            onKeyDown={onDialogKeyDown}
            onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          >
            <button
              type="button"
              ref={closeBtnRef}
              className="byobu-close"
              aria-label="Cerrar galería"
              onClick={close}
            >×</button>

            <div className="byobu-panel">
              <div
                className="byobu-stage"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
              >
                <figure key={view.index} ref={leafRef} className={leafCls}>
                  {current && failed[current.url] ? (
                    <PaperLeaf ordinal={view.index + 1} />
                  ) : current ? (
                    <img
                      src={current.url}
                      alt={current.alt || 'Lámina ' + (view.index + 1) + ' de ' + title}
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      draggable={false}
                      onLoad={() => markLoaded(current.url)}
                      onError={() => markFailed(current.url)}
                    />
                  ) : null}
                  {current && !failed[current.url] && !loaded[current.url] && (
                    <span className="byobu-leaf__veil" aria-hidden="true"></span>
                  )}
                </figure>

                {n > 1 && (
                  <button
                    type="button"
                    className={'byobu-hinge byobu-hinge--prev' + (atStart ? ' byobu-hinge--off' : '')}
                    aria-label="Lámina anterior"
                    aria-disabled={atStart ? 'true' : undefined}
                    onClick={() => nav(-1)}
                  >
                    <span className="byobu-hinge__leaf" aria-hidden="true"></span>
                    <svg className="byobu-hinge__glyph" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="M14.5 5 8 12l6.5 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path></svg>
                  </button>
                )}
                {n > 1 && (
                  <button
                    type="button"
                    className={'byobu-hinge byobu-hinge--next' + (atEnd ? ' byobu-hinge--off' : '')}
                    aria-label="Lámina siguiente"
                    aria-disabled={atEnd ? 'true' : undefined}
                    onClick={() => nav(1)}
                  >
                    <span className="byobu-hinge__leaf" aria-hidden="true"></span>
                    <svg className="byobu-hinge__glyph" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="M9.5 5 16 12l-6.5 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path></svg>
                  </button>
                )}
              </div>

              {n > 1 && (
                <p className="byobu-counter" aria-live="polite" aria-atomic="true">
                  {view.index + 1} / {n}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
