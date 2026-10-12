// La máscara kitsune del oráculo: trazos finos en oro, marcas rituales en
// bermellón y, solo cuando acierta, el brillo cian de los ojos. Un SVG en
// línea sin filtros; la postura la pone el CSS según data-pose.

/**
 * Posturas: 'reposo' (levita), 'duda' (ladeada tras un «no sé»),
 * 'reverencia' (se inclina al acertar) y 'pena' (baja la mirada al fallar).
 * `brillo` encienden los ojos.
 */
export function Mascara({ pose = 'reposo', brillo = false }) {
  return (
    <div className="oraculo-mascara" data-pose={pose} data-brillo={brillo || undefined}>
      <svg viewBox="0 0 200 226" className="oraculo-mascara-svg" role="img" aria-label="Máscara kitsune del oráculo">
        <g className="oraculo-mascara-trazo">
          {/* orejas */}
          <path d="M64 48 38 6l56 24" />
          <path d="M136 48 162 6l-56 24" />
          {/* frente y rostro */}
          <path d="M64 48q36-18 72 0" />
          <path d="M64 48C48 68 42 92 50 118c8 36 28 62 50 86 22-24 42-50 50-86 8-26 2-50-14-70" />
          {/* cejas */}
          <path d="M62 98q16-12 32-2" />
          <path d="M138 98q-16-12-32-2" />
          {/* hocico */}
          <path d="M92 156q8 10 16 0" />
          <path d="M100 166v10" />
          <path d="M60 152l22 4" />
          <path d="M140 152l-22 4" />
        </g>
        <g className="oraculo-mascara-marca">
          <path d="M56 78q18-12 36-4" />
          <path d="M144 78q-18-12-36-4" />
          <path d="M54 128q14 10 28 2" />
          <path d="M146 128q-14 10-28 2" />
          <path d="M100 38v22" />
        </g>
        <g className="oraculo-mascara-ojos">
          <path d="M70 108q12-8 26 0" />
          <path d="M130 108q-12-8-26 0" />
        </g>
        <g className="oraculo-mascara-brillo">
          <circle cx="83" cy="106" r="5.5" />
          <circle cx="83" cy="106" r="2.4" />
          <circle cx="117" cy="106" r="5.5" />
          <circle cx="117" cy="106" r="2.4" />
        </g>
      </svg>
    </div>
  )
}
