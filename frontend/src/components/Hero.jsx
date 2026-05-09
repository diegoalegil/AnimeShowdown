import { motion } from 'framer-motion'
import { ArrowRight, TrendingUp } from 'lucide-react'
import FloatingCards from './FloatingCards'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

const logoVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, ease: 'easeOut' },
  },
}

function Hero() {
  return (
    <section
      className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-16 sm:px-8 sm:py-20"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 50% 0%, var(--color-accent-soft), transparent 60%)',
      }}
    >
      <FloatingCards />
      <motion.div
        className="relative z-10 flex max-w-3xl flex-col items-center gap-6 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.img
          src="/logo.webp"
          alt=""
          width={240}
          height={240}
          className="h-44 w-44 object-contain sm:h-56 sm:w-56"
          style={{ filter: 'drop-shadow(0 0 50px rgb(255 46 99 / 0.4))' }}
          variants={logoVariants}
        />
        <motion.span
          className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted"
          variants={itemVariants}
        >
          Beta · 96 personajes
        </motion.span>
        <motion.h1
          className="text-[clamp(2.25rem,6vw,4rem)] leading-[1.05] tracking-tight"
          variants={itemVariants}
        >
          Vota a tus personajes de <span className="text-accent">anime</span> favoritos
        </motion.h1>
        <motion.p
          className="max-w-xl text-[clamp(0.9375rem,1.6vw,1.125rem)] leading-relaxed text-fg-muted"
          variants={itemVariants}
        >
          Torneos cara a cara, brackets visuales y rankings ELO en vivo. Quédate con el campeón del próximo bracket.
        </motion.p>
        <motion.div
          className="mt-2 flex flex-wrap justify-center gap-3"
          variants={itemVariants}
        >
          <a
            href="#"
            className="group inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
          >
            Explora torneos
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-5 py-3 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
          >
            <TrendingUp className="h-4 w-4" />
            Ver ranking
          </a>
        </motion.div>
      </motion.div>
    </section>
  )
}

export default Hero
