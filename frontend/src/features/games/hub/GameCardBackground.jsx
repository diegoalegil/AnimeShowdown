import { BRAND_VISUALS } from '../../../data/visual-assets'
import ResponsivePicture from '../../../components/ResponsivePicture'

function GameCardBackground({ visual, opacity = 1, priority = false }) {
  const image =
    visual?.image || visual?.fallbackImage || BRAND_VISUALS.games.image
  return (
    <>
      <ResponsivePicture
        visual={visual}
        src={image}
        sizes="(min-width: 1024px) 33vw, 100vw"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]"
        style={{ opacity }}
      />
      {/* Scrim mínimo: las covers oscuras (anime-reveal, anigrid, oráculo)
          quedaban apagadas con el lavado anterior (imagen a 0.92 + capa
          horizontal 0.45). El degradado vive solo abajo, donde está el
          texto de la card; el resto del arte respira a plena luz. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgb(5 8 14 / 0.02) 0%, rgb(5 8 14 / 0.10) 55%, rgb(5 8 14 / 0.82) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.18) 1px, transparent 0)',
          backgroundSize: '42px 42px',
          maskImage: 'linear-gradient(to bottom, black, transparent 72%)',
        }}
      />
    </>
  )
}

export default GameCardBackground
