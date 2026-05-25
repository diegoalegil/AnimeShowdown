function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={`as-panel flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-dashed p-8 text-center sm:p-12 ${className}`}
      role="status"
    >
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/35 bg-gold-soft text-gold">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <div className="flex max-w-xl flex-col gap-2">
        {title && (
          <h2 className="text-2xl font-black tracking-tight text-fg-strong">
            {title}
          </h2>
        )}
        {description && (
          <p className="text-sm leading-7 text-fg-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}

export default EmptyState
