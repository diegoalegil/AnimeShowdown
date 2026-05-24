import { forwardRef } from 'react'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

const Section = forwardRef(function Section(
  {
    as: Component = 'section',
    eyebrow,
    title,
    description,
    className = '',
    containerClassName = 'mx-auto max-w-6xl',
    headerClassName = 'mb-10 flex flex-col items-start gap-3',
    headerContentClassName = 'flex flex-col gap-2',
    headerAction,
    eyebrowClassName = 'text-[12px] font-semibold uppercase tracking-[0.05em] text-gold',
    titleClassName = 'text-[clamp(1.75rem,4vw,2.75rem)] tracking-tight',
    descriptionClassName = 'max-w-3xl text-[14px] text-fg-muted',
    children,
    ...props
  },
  ref,
) {
  const hasHeader = eyebrow || title || description
  const headerContent = (
    <>
      {eyebrow && <span className={eyebrowClassName}>{eyebrow}</span>}
      {title && <h2 className={titleClassName}>{title}</h2>}
      {description && (
        <p className={descriptionClassName}>{description}</p>
      )}
    </>
  )

  return (
    <Component
      ref={ref}
      className={cx('px-5 py-16 sm:px-8 sm:py-20', className)}
      {...props}
    >
      <div className={containerClassName}>
        {hasHeader && (
          <div className={headerClassName}>
            {headerAction ? (
              <div className={headerContentClassName}>{headerContent}</div>
            ) : (
              headerContent
            )}
            {headerAction}
          </div>
        )}
        {children}
      </div>
    </Component>
  )
})

export default Section
