import { BRAND_VISUALS } from '../../../data/visual-assets'

function GameCardBackground({ visual, opacity = 0.92 }) {
  const image =
    visual?.image || visual?.fallbackImage || BRAND_VISUALS.games.image
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-[1.03]"
        style={{
          backgroundImage: `url("${image}")`,
          backgroundPosition: visual?.objectPosition ?? 'center center',
          opacity,
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgb(5 8 14 / 0.45) 0%, rgb(5 8 14 / 0.20) 50%, rgb(5 8 14 / 0.10) 100%), linear-gradient(180deg, rgb(5 8 14 / 0.05) 0%, rgb(5 8 14 / 0.18) 50%, rgb(5 8 14 / 0.78) 100%)',
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
