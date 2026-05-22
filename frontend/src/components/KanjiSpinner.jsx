/**
 * Spinner temático con kanji animado en el centro.
 *
 * <p>Sustituye al patrón repetido <code>h-6 w-6 animate-spin rounded-full
 * border-2 border-accent border-t-transparent</code> que aparecía en
 * ~10 cards de loading. Un círculo de borde superior animado es
 * visualmente lo mismo que cualquier spinner de SaaS y rompe la
 * dirección artística "torneo anime cinematográfico" que tiene el
 * resto del producto.
 *
 * <p>Variantes:
 * <ul>
 *   <li>{@code size="sm"} 32px — cards pequeñas en perfil/listas</li>
 *   <li>{@code size="md"} 48px — secciones grandes</li>
 *   <li>{@code size="lg"} 64px — full-page Suspense</li>
 * </ul>
 *
 * <p>El kanji por defecto es {@code 戦} (sen, "batalla"). Cualquier
 * carácter funciona — usar el del contexto cuando exista
 * ({@code 影} para Shadow Guess, {@code 御} para Omikuji, etc.).
 */

const SIZE_CLASSES = {
  sm: { container: 'h-8 w-8', kanji: 'text-sm' },
  md: { container: 'h-12 w-12', kanji: 'text-xl' },
  lg: { container: 'h-16 w-16', kanji: 'text-2xl' },
}

function KanjiSpinner({
  kanji = '戦',
  size = 'sm',
  tone = 'accent',
  className = '',
  label = 'Cargando',
}) {
  const sz = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm
  // tone determina el color del borde animado y el glow.
  const toneRing = tone === 'gold'
    ? 'border-gold/30 border-t-gold'
    : tone === 'cyan'
      ? 'border-cyan-500/25 border-t-cyan-400'
      : 'border-accent/25 border-t-accent'
  // Antes el kanji siempre era gold incluso cuando tone=accent. Eso pintaba
  // un anillo rojo y un kanji amarillo dentro — visualmente disonante,
  // sobre todo en VotarPage (tone=accent) donde el spinner gigante salía
  // como "círculo amarillo desencajado" según feedback del usuario.
  // Ahora el kanji hereda el tono del anillo: identidad cromática única.
  const toneKanji = tone === 'gold'
    ? 'text-gold'
    : tone === 'cyan'
      ? 'text-cyan-300'
      : 'text-accent'
  const toneHalo = tone === 'gold'
    ? 'bg-gold/10'
    : tone === 'cyan'
      ? 'bg-cyan-500/10'
      : 'bg-accent/10'
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`relative ${sz.container} ${className}`}
    >
      <div className={`absolute inset-0 rounded-full ${toneHalo}`} />
      <div className={`absolute inset-0 animate-spin rounded-full border-2 ${toneRing}`} />
      <span
        aria-hidden="true"
        lang="ja"
        className={`absolute inset-0 flex items-center justify-center font-mono font-black ${sz.kanji} ${toneKanji}`}
      >
        {kanji}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default KanjiSpinner
