function CardEyebrow({ icon: Icon, label, tono = 'text-gold' }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${tono}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

export default CardEyebrow
