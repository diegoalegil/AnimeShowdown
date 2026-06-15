import SparkBurst from './SparkBurst'

/**
 * ForgeIngot — el lingote sellado sobre el yunque; recibe los golpes.
 *
 * Es un `<button>` (hit target >= 232x188px) operable con teclado (Enter/Espacio
 * disparan el click nativo). La llegada, el flash del filo, la microsacudida y
 * la rotura son @keyframes de forge.css disparados por data-attributes (sin
 * WAAPI; CSP por hash OK). Las grietas son spans con clip-path estático
 * revelados por opacity según `strikes`.
 *
 * NB: el componente NO tiene estado propio ni efectos — todo deriva de props
 * (estado por golpe, no por efectos): un re-render a mitad de ritual jamás
 * re-dispara una fase.
 *
 * @param {Object} props
 * @param {number} props.strikes    Golpes encajados (0..blows).
 * @param {number} props.blows      Golpes totales para romper.
 * @param {boolean} props.broken    True cuando se rompe (mitades se separan).
 * @param {boolean} props.arriving  True durante la fase de llegada (caída).
 * @param {boolean} [props.calm]    Reduced-motion: sin chispas/sacudida/caída.
 * @param {() => void} props.onStrike  Handler de golpe (click/tap/Enter/Espacio).
 */
export default function ForgeIngot({ strikes, blows, broken, arriving, calm = false, onStrike }) {
  const fire = strikes <= 0 || calm ? '' : strikes % 2 ? 'a' : 'b'
  const label = `golpear el lingote (golpe ${Math.min(strikes + 1, blows)} de ${blows})`

  return (
    <button
      type="button"
      className="forge-ingot"
      aria-label={label}
      data-arriving={arriving && !calm ? 'true' : 'false'}
      data-fire={fire}
      data-broken={broken ? 'true' : 'false'}
      onClick={onStrike}
    >
      <span className="forge-ingot__bar">
        <span className="forge-ingot__half forge-ingot__half--l" />
        <span className="forge-ingot__half forge-ingot__half--r" />
        {/* 印 = sello/marca (kanji canónico del repo) */}
        <span className="forge-ingot__seal">印</span>
        <span className="forge-ingot__cracks">
          {[1, 2, 3, 4, 5].map((c) => (
            <span
              key={c}
              className={`forge-ingot__crack forge-ingot__crack--${c}`}
              data-on={c <= strikes ? 'true' : 'false'}
            />
          ))}
        </span>
        <span className="forge-ingot__edge" />
      </span>
      <SparkBurst strikeId={strikes} calm={calm} />
    </button>
  )
}
