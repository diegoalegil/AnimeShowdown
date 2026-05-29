function HighlightMatch({ text, query }) {
  if (!query) return text

  const lower = text.toLowerCase()
  const needle = query.toLowerCase()
  const idx = lower.indexOf(needle)

  if (idx === -1) return text

  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-lg bg-gold/20 px-0.5 text-gold">
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length)}
    </>
  )
}

export default HighlightMatch
