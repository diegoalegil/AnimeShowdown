import { isVisualDebugActive } from '../lib/visualDebug'
import AnimeSceneMorph from './AnimeSceneMorph'
import ResponsivePicture from './ResponsivePicture'
import VisualDebugBadge from './VisualDebugBadge'

// Con sceneMorphSlug las capas de imagen (picture + vignette) viajan juntas
// en el snapshot del morph scene → hero del detalle de anime; glow de
// esquinas, dot-grid y contenido quedan fuera — snapshot limpio.
function CoverMedia({ sceneMorphSlug, children }) {
  if (!sceneMorphSlug) return children
  return (
    <AnimeSceneMorph slug={sceneMorphSlug} kind="card" className="absolute inset-0">
      {children}
    </AnimeSceneMorph>
  )
}

function EditorialCover({
  visual,
  title,
  eyebrow,
  meta,
  children,
  className = '',
  contentClassName = '',
  imageClassName = '',
  compact = false,
  // Override opcional: si se pasa una URL aquí, se usa en vez de
  // visual.image. Útil cuando una card representa un universo a través de
  // su personaje top (carta SSR vertical 2:3) en vez del banner panorámico.
  imageOverride,
  // Override del object-position para encuadrar mejor cuando la imagen
  // tiene una orientación distinta a la esperada por el visual.
  objectPositionOverride,
  // Slug del anime cuando esta cover es origen/destino del morph
  // scene → hero del catálogo (ver CoverMedia).
  sceneMorphSlug,
}) {
  const cover = visual ?? {}
  const image = imageOverride || cover.image || cover.fallbackImage || '/img/stage/home-pulse.webp'
  const accentRgb = cover.accentRgb ?? '159 29 44'
  const glowRgb = cover.glowRgb ?? '197 161 90'
  const objectPosition = objectPositionOverride ?? cover.objectPosition ?? 'center'

  return (
    <div
      data-editorial-cover="true"
      data-visual-type={cover.type}
      data-visual-slug={cover.slug}
      className={`group/cover relative isolate overflow-hidden rounded-xl border border-white/10 bg-bg ${className}`}
      style={{
        '--cover-accent': accentRgb,
        '--cover-glow': glowRgb,
      }}
    >
      <CoverMedia sceneMorphSlug={sceneMorphSlug}>
        <ResponsivePicture
          // Con imageOverride la imagen es otra (p.ej. carta de personaje /img/*),
          // cuyas variantes NO son las del banner del visual → sin srcsets ahí.
          visual={imageOverride ? undefined : visual}
          src={image}
          objectPosition={objectPosition}
          sizes="(min-width: 1024px) 33vw, 100vw"
          className={`absolute inset-0 transition-transform duration-700 group-hover/cover:scale-[1.04] ${imageClassName}`}
        />
        {/* Vignette solo en el bottom, donde va el texto, más glow accent sutil
            en esquinas para identidad sin tintar la imagen. */}
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, transparent 38%, rgb(5 8 14 / 0.55) 70%, rgb(5 8 14 / 0.92) 100%)',
          }}
        />
      </CoverMedia>
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            `radial-gradient(circle at 8% 100%, rgb(var(--cover-accent) / 0.22), transparent 18rem), ` +
            `radial-gradient(circle at 92% 0%, rgb(var(--cover-glow) / 0.10), transparent 14rem)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.09]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.14) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, black, transparent 50%)',
        }}
      />
      {/* El shell de la página ya tiene lateralKanji; no añadimos kanji extra
          en cada card individual. */}
      {isVisualDebugActive() && <VisualDebugBadge visual={cover} where="EditorialCover" />}
      <div
        className={`relative flex h-full flex-col justify-end ${
          compact ? 'p-4' : 'p-5 sm:p-6'
        } ${contentClassName}`}
      >
        {eyebrow && (
          <p
            className="mb-2 w-fit rounded-full border px-2.5 py-1 text-[10px] font-black"
            style={{
              borderColor: `rgb(${accentRgb} / 0.46)`,
              background: `rgb(${accentRgb} / 0.16)`,
              color: `rgb(${glowRgb} / 1)`,
            }}
          >
            {eyebrow}
          </p>
        )}
        {title && (
          <h3 className="line-clamp-2 text-xl font-black leading-tight text-fg-strong drop-shadow sm:text-2xl">
            {title}
          </h3>
        )}
        {meta && <p className="mt-1 line-clamp-2 text-[12px] text-fg-muted">{meta}</p>}
        {children}
      </div>
    </div>
  )
}

export default EditorialCover
