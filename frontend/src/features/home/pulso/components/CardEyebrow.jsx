// de-ai (DESIGN.md): sin uppercase/tracking ni pill tintado; eyebrow inline en
// sentence-case, el color de marca va en el texto/icono, no en chrome.
function CardEyebrow({ icon: Icon, label, tono = 'text-gold' }) {
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 text-xs font-semibold ${tono}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

export default CardEyebrow
