import { useEffect, useId, useRef, useState } from 'react';
import './sealed-document.css';

/* Altura de la hairline del índice, en px.
   Mantener en sync con `height` de .sd-toc-marker en sealed-document.css. */
const MARKER_HEIGHT_PX = 20;

/* Línea de activación del scroll-spy: fracción del alto del viewport.
   Una sección es "la activa" si su inicio ya cruzó esta línea. */
const SPY_LINE_RATIO = 0.3;

const sectionNum = (index) => `${String(index + 1).padStart(2, '0')}.`;

/**
 * SealedDocument — layout de "documento de archivo sellado" para las páginas
 * legales (/privacidad, /terminos, /dmca).
 *
 * El texto legal entra por `sections[].body` y se renderiza byte a byte:
 * este componente NO transforma, trunca ni reformatea el contenido.
 *
 * Coreografía (mínima — son documentos):
 *  - el sello asienta al montar: 250 ms, ease-stamp local (overshoot de hanko),
 *    más sangrado de tinta por cross-fade de opacity (180→400 ms);
 *  - la hairline del índice se desliza a la sección activa: 150 ms, var(--ease-brush).
 * Con prefers-reduced-motion ambas saltan al estado final.
 *
 * Único JS vivo: el scroll-spy (un IntersectionObserver compartido por
 * documento). Sin loops, sin rAF, sin listeners de scroll.
 *
 * @param {object} props
 * @param {string} props.title
 *   Título del documento (h1). Se renderiza tal cual.
 * @param {string} [props.docId]
 *   Referencia de expediente, p. ej. "Expediente AS-LEG-01 · /privacidad".
 *   Se muestra en mono sobre el título. Dato de producto: viene de fuera,
 *   no se inventa aquí.
 * @param {string} props.lastRevision
 *   Fecha de última revisión YA formateada (string opaco: el componente no
 *   la parsea ni la genera — nada de new Date() en render).
 * @param {Array<{id: string, title: string, body: import('react').ReactNode}>} props.sections
 *   Secciones en orden. `id` es el anchor público (#id — funciona desde
 *   enlaces externos), `title` alimenta h2 e índice, `body` es el texto
 *   legal INTACTO (JSX). La numeración 01., 02.… se deriva del orden.
 * @param {string} [props.sealGlyph="印"]
 *   Kanji del sello de esquina. 印 ya está en el subset canónico.
 * @param {string} [props.watermarkGlyph="誓"]
 *   Kanji de la marca de agua al 5%. 誓 ya está en el subset canónico.
 * @param {string} [props.tocLabel="Índice del documento"]
 *   aria-label del nav del índice.
 */
function SealedDocument({
  title,
  docId,
  lastRevision,
  sections,
  sealGlyph = '印',
  watermarkGlyph = '誓',
  tocLabel = 'Índice del documento',
}) {
  const rootRef = useRef(null);
  const tocRef = useRef(null);
  const markerRef = useRef(null);
  const selectId = useId();

  const [activeId, setActiveId] = useState(() =>
    sections.length > 0 ? sections[0].id : null
  );

  /* Si cambian las secciones (navegación same-document a otra legal),
     re-anclamos el índice. Ajuste DURANTE el render con guard — patrón
     canónico compatible con React Compiler. */
  const [prevSections, setPrevSections] = useState(sections);
  if (prevSections !== sections) {
    setPrevSections(sections);
    setActiveId(sections.length > 0 ? sections[0].id : null);
  }

  /* Scroll-spy: UN IntersectionObserver compartido para todas las secciones.
     El callback relee las posiciones reales, así el resultado es correcto
     también al llegar al final del documento (la última sección corta gana
     cuando el cierre es visible). setState solo dentro del callback del
     observer (legal); el observer dispara su pasada inicial solo. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const els = Array.from(root.querySelectorAll('[data-sd-anchor]'));
    if (els.length === 0) return undefined;
    const endEl = root.querySelector('[data-sd-end]');

    const io = new IntersectionObserver(
      () => {
        const line = window.innerHeight * SPY_LINE_RATIO;
        let current = els[0];
        for (const el of els) {
          if (el.getBoundingClientRect().top <= line) current = el;
        }
        if (endEl && endEl.getBoundingClientRect().bottom <= window.innerHeight + 1) {
          current = els[els.length - 1];
        }
        setActiveId(current.getAttribute('data-sd-anchor'));
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    els.forEach((el) => io.observe(el));
    if (endEl) io.observe(endEl);
    return () => io.disconnect();
  }, [sections]);

  /* La hairline sigue a la sección activa: escritura DOM directa en un
     effect (transform/opacity only — nada de animar top/height). */
  useEffect(() => {
    const toc = tocRef.current;
    const marker = markerRef.current;
    if (!toc || !marker || activeId === null) return;
    const link = toc.querySelector(`[data-sd-toc="${CSS.escape(activeId)}"]`);
    if (!link) return;
    const y = link.offsetTop + (link.offsetHeight - MARKER_HEIGHT_PX) / 2;
    marker.style.transform = `translateY(${y}px)`;
    marker.style.opacity = '1';
  }, [activeId, sections]);

  /* Selector móvil: navegación por ancla nativa (respeta scroll-margin y
     funciona con cualquier scroll container). El spy re-sincroniza el valor. */
  const handleSelectChange = (event) => {
    window.location.hash = `#${event.target.value}`;
  };

  return (
    <div className="sd-root" ref={rootRef}>
      <span className="sd-watermark" aria-hidden="true">{watermarkGlyph}</span>
      <div className="sd-shell">
        <div className="sd-layout">
          <nav className="sd-toc" aria-label={tocLabel}>
            <div className="sd-select-bar">
              <label className="sd-select-label" htmlFor={selectId}>Sección</label>
              <div className="sd-select-wrap">
                <select
                  className="sd-select"
                  id={selectId}
                  value={activeId ?? (sections[0] ? sections[0].id : '')}
                  onChange={handleSelectChange}
                >
                  {sections.map((section, index) => (
                    <option key={section.id} value={section.id}>
                      {sectionNum(index)} {section.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sd-toc-panel">
              <p className="sd-toc-heading">Índice</p>
              <div className="sd-toc-listwrap" ref={tocRef}>
                <span className="sd-toc-marker" ref={markerRef} aria-hidden="true"></span>
                <ul className="sd-toc-list">
                  {sections.map((section, index) => (
                    <li key={section.id}>
                      <a
                        className="sd-toc-link"
                        href={`#${section.id}`}
                        data-sd-toc={section.id}
                        aria-current={activeId === section.id ? 'true' : undefined}
                      >
                        <span className="sd-toc-num" aria-hidden="true">{sectionNum(index)}</span>
                        <span>{section.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </nav>

          <main className="sd-main">
            <header className="sd-header">
              <div className="sd-header-meta">
                {docId ? <p className="sd-eyebrow">{docId}</p> : null}
                <h1 className="sd-title">{title}</h1>
                <p className="sd-revision">Última revisión · {lastRevision}</p>
              </div>
              <div className="sd-seal" role="img" aria-label="Sello de documento oficial">
                <span className="sd-seal-bleed" aria-hidden="true">{sealGlyph}</span>
                <span className="sd-seal-face" aria-hidden="true">{sealGlyph}</span>
              </div>
            </header>

            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                data-sd-anchor={section.id}
                className="sd-section"
                aria-labelledby={`${section.id}-h`}
              >
                <h2 className="sd-h2" id={`${section.id}-h`}>
                  <span className="sd-h2-num" aria-hidden="true">{sectionNum(index)}</span>
                  <span>{section.title}</span>
                </h2>
                <div className="sd-section-body">{section.body}</div>
              </section>
            ))}

            <div className="sd-end" data-sd-end="" aria-hidden="true">
              <span className="sd-end-glyph">{sealGlyph}</span>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default SealedDocument;
