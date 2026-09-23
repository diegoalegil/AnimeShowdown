import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Carta } from './Carta.jsx'
import { EtiquetaVertical } from './EtiquetaVertical.jsx'
import { Hanko, SelloMarca } from './Hanko.jsx'

const FRIEREN = {
  id: 'frieren',
  n: 370,
  nombre: 'Frieren',
  anime: "Frieren: Beyond Journey's End",
  animeId: 'frieren',
  img: 'img/Frieren/frieren',
  color: '#8a9aa6',
}
const LUFFY_G5 = {
  id: 'e-luffy__gear5',
  n: 49,
  nombre: 'Monkey D. Luffy',
  variante: 'Gear 5',
  anime: 'One Piece',
  animeId: 'one-piece',
  img: 'img/especiales/luffy__gear5.webp',
}

const pintar = (elemento) => renderToStaticMarkup(<MemoryRouter>{elemento}</MemoryRouter>)

describe('Carta', () => {
  it('enlaza a la ficha con la cartela número · nombre / serie', () => {
    const html = pintar(<Carta carta={FRIEREN} />)
    expect(html).toContain('href="/carta/frieren"')
    expect(html).toContain('>0370<')
    expect(html).toContain('>Frieren<')
    expect(html).toContain('Frieren: Beyond Journey&#x27;s End')
  })

  it('carga la imagen en diferido con srcset, sizes y proporción fija', () => {
    const html = pintar(<Carta carta={FRIEREN} />)
    expect(html).toMatch(/srcSet="[^"]*frieren-300\.webp 300w/)
    expect(html).toContain('sizes="(min-width: 1100px) 290px')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('decoding="async"')
    expect(html).toContain('width="600" height="900"')
    expect(html).toContain('--tono:#8a9aa6')
    // Con cartela, el texto ya nombra la carta: la imagen no lo repite.
    expect(html).toContain('alt=""')
  })

  it('carga de inmediato lo prioritario y describe la imagen sin cartela', () => {
    const html = pintar(<Carta carta={FRIEREN} prioridad cartela={false} enlace={false} compartida />)
    expect(html).toContain('loading="eager"')
    expect(html).toContain('fetchPriority="high"')
    expect(html).toContain('alt="Carta de Frieren, de Frieren: Beyond Journey&#x27;s End"')
    expect(html).toContain('view-transition-name:carta')
    expect(html).not.toContain('href=')
  })

  it('muestra la posesión con discreción y los sellos 新 y 特', () => {
    expect(pintar(<Carta carta={FRIEREN} />)).not.toContain('carta-copias')
    const una = pintar(<Carta carta={FRIEREN} copias={1} />)
    expect(una).toContain('En tu colección')
    expect(una).not.toContain('×')
    expect(pintar(<Carta carta={FRIEREN} copias={3} nueva />)).toMatch(/×3.*copias en tu colección/)
    expect(pintar(<Carta carta={FRIEREN} nueva />)).toContain('>新<')

    const especial = pintar(<Carta carta={LUFFY_G5} />)
    expect(especial).toContain('>特<')
    expect(especial).toContain('data-especial="true"')
    expect(especial).toContain('>E-49<')
    expect(especial).toContain('Especial · Gear 5')
    expect(especial).not.toContain('srcSet')
  })

  it('se prepara para la entrada escalonada y las rejillas largas', () => {
    const html = pintar(<Carta carta={FRIEREN} entrada diferida tamano="album" />)
    expect(html).toContain('data-revelar=""')
    expect(html).toContain('class="carta carta--album carta--diferida"')
  })
})

describe('Hanko y EtiquetaVertical', () => {
  it('los sellos son decorativos salvo que lleven etiqueta', () => {
    expect(renderToStaticMarkup(<Hanko kanji="新" />)).toContain('aria-hidden="true"')
    expect(renderToStaticMarkup(<Hanko kanji="新" etiqueta="Nueva" />)).toContain('aria-label="Nueva"')
    expect(renderToStaticMarkup(<SelloMarca etiqueta="AnimeShowdown" />)).toContain('role="img"')
  })

  it('el texto vertical va marcado en japonés', () => {
    const html = renderToStaticMarkup(<EtiquetaVertical ja="ギャラリー" />)
    expect(html).toBe('<span lang="ja" class="tate " aria-hidden="true">ギャラリー</span>')
  })
})
