import { test, expect } from '@playwright/test'

/**
 * Guardrail responsive de la home — bloquea cualquier overflow horizontal
 * en breakpoints críticos. Si alguien rompe el layout en el futuro, este
 * test cae y CI lo señala antes del merge.
 *
 * Cubre 8 viewports que mapean a devices reales:
 *   - 360x800        Android compacto (Galaxy S8 / Pixel 4a)
 *   - 390x844        iPhone 13 mini / iPhone 12
 *   - 430x932        iPhone 14 Pro Max
 *   - 768x1024       iPad portrait
 *   - 1024x768       iPad landscape
 *   - 1280x800       laptop estándar
 *   - 1440x900       laptop mediano
 *   - 1920x1080      desktop FHD
 *
 * Métricas validadas por viewport (ambas obligatorias):
 *   - documentElement.scrollWidth <= documentElement.clientWidth
 *   - body.scrollWidth            <= body.clientWidth
 *
 * Esperamos a `networkidle` para que la hidratación del catálogo termine,
 * más un settle de 500ms para que framer-motion cierre layout animations.
 *
 * FIXME_VIEWPORTS: set para marcar viewports temporalmente bloqueados por
 * overflow originado fuera de scope (Header/Footer/componentes compartidos).
 * Cada entrada debe documentarse en HANDOFF_SESSION_B.md con razón.
 */

const VIEWPORTS = [
  { name: 'android-compact',    width: 360,  height: 800  },
  { name: 'iphone-13-mini',     width: 390,  height: 844  },
  { name: 'iphone-14-pro-max',  width: 430,  height: 932  },
  { name: 'ipad-portrait',      width: 768,  height: 1024 },
  { name: 'ipad-landscape',     width: 1024, height: 768  },
  { name: 'laptop-small',       width: 1280, height: 800  },
  { name: 'laptop-mid',         width: 1440, height: 900  },
  { name: 'desktop-fhd',        width: 1920, height: 1080 },
]

// Vacío por defecto. Solo poblar cuando un viewport sea irreparable dentro
// del scope de esta suite (overflow en componente compartido fuera de home).
const FIXME_VIEWPORTS = new Set([])

for (const vp of VIEWPORTS) {
  test(`home sin overflow horizontal @ ${vp.name} ${vp.width}x${vp.height}`, async ({ page }) => {
    test.fixme(
      FIXME_VIEWPORTS.has(vp.name),
      `Viewport bloqueado fuera de scope — ver HANDOFF_SESSION_B.md (${vp.name})`,
    )

    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
    // Settle de animaciones framer-motion antes de medir.
    await page.waitForTimeout(500)

    const sizes = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      docC: document.documentElement.clientWidth,
      bodyW: document.body.scrollWidth,
      bodyC: document.body.clientWidth,
    }))

    expect(
      sizes.docW,
      `<html> scrollWidth (${sizes.docW}) > clientWidth (${sizes.docC}) @ ${vp.name}`,
    ).toBeLessThanOrEqual(sizes.docC)
    expect(
      sizes.bodyW,
      `<body> scrollWidth (${sizes.bodyW}) > clientWidth (${sizes.bodyC}) @ ${vp.name}`,
    ).toBeLessThanOrEqual(sizes.bodyC)
  })
}
