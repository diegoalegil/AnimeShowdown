// KitsuneMask — la máscara del oráculo como SVG modular de hairlines.
// 15 trazos: 10 hairlines oro (geometría) + 5 marcas carmesí (hanko).
// Cero ilustración cargada, cero emoji, cero filtros SVG (regla Safari):
// el glint del veredicto es un par de círculos cian con cross-fade de
// opacity, nunca un glow filtrado.
//
// Tokens vía CSS custom props (guard de CI: prohibido hex en JSX).

/**
 * Posturas de la máscara. El transform vive en una clase CSS
 * (index.css → .orc-mask--*) para que la transición 300ms var(--ease-lift)
 * sea declarativa y reduced-motion la pueda cortar en un solo sitio.
 * @typedef {'idle' | 'uncertain' | 'bow' | 'sorry'} KitsuneMaskPose
 */

/**
 * @param {object} props
 * @param {KitsuneMaskPose} [props.pose='idle'] Postura actual:
 *   idle (reposo), uncertain (ladeo 4° — "no estoy seguro", sin juicio),
 *   bow (inclinación 8° previa al estampado), sorry (descubierta apenada:
 *   −9° + caída de 6px).
 * @param {boolean} [props.glint=false] Glint cian de los ojos — SOLO en el
 *   instante del veredicto (uso puntual de --color-electric).
 * @param {number} [props.size=186] Ancho en px; el alto sale del ratio del viewBox.
 * @param {string} [props.className]
 */
export default function KitsuneMask({ pose = 'idle', glint = false, size = 186, className = '' }) {
  return (
    <div className={`orc-mask orc-mask--${pose} ${className}`}>
      <svg
        width={size}
        height={Math.round(size * (226 / 200))}
        viewBox="0 0 200 226"
        role="img"
        aria-label="Máscara kitsune del oráculo"
        className="block overflow-visible"
      >
        {/* hairlines oro — la geometría del rostro */}
        <g
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M64,46 L40,6 L92,28" />
          <path d="M136,46 L160,6 L108,28" />
          <path d="M64,46 Q100,30 136,46" />
          <path d="M64,46 C50,64 44,88 50,112 C58,148 78,176 100,202 C122,176 142,148 150,112 C156,88 150,64 136,46" />
          <path d="M64,96 Q78,86 92,94" />
          <path d="M136,96 Q122,86 108,94" />
          <path d="M94,152 Q100,160 106,152" />
          <path d="M100,162 L100,172" />
          <path d="M62,148 L82,152" />
          <path d="M138,148 L118,152" />
        </g>
        {/* marcas rituales carmesí — bermellón del hanko */}
        <g fill="none" stroke="var(--color-hanko)" strokeWidth="3.5" strokeLinecap="round" opacity="0.9">
          <path d="M58,76 Q74,66 90,72" />
          <path d="M142,76 Q126,66 110,72" />
          <path d="M56,124 Q68,132 80,126" />
          <path d="M144,124 Q132,132 120,126" />
          <path d="M100,40 L100,58" />
        </g>
        {/* glint del veredicto — señal puntual en electric, opacity-only */}
        <g className={`orc-mask__glint ${glint ? 'orc-mask__glint--on' : ''}`}>
          <circle cx="79" cy="91" r="5" fill="var(--color-electric)" opacity="0.3" />
          <circle cx="79" cy="91" r="2.2" fill="var(--color-electric)" />
          <circle cx="121" cy="91" r="5" fill="var(--color-electric)" opacity="0.3" />
          <circle cx="121" cy="91" r="2.2" fill="var(--color-electric)" />
        </g>
      </svg>
    </div>
  )
}
