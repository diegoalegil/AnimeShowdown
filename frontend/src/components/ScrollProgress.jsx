import { useEffect, useRef } from 'react'

function ScrollProgress() {
  const barRef = useRef(null)

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      const bar = barRef.current
      if (!bar) return
      const root = document.documentElement
      const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight)
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll))
      bar.style.transform = `scaleX(${progress})`
    }

    const scheduleUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [])

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-accent"
      style={{
        boxShadow: '0 0 12px rgb(159 29 44 / 0.5)',
        transform: 'scaleX(0)',
        willChange: 'transform',
      }}
    />
  )
}

export default ScrollProgress
