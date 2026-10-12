import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { catalogo } from '../../lib/catalog.js'
import { JUEGOS, juegoPorSlug } from '../registro.js'
import { Autocompletar } from './Autocompletar.jsx'
import { BuscadorPersonajes } from './BuscadorPersonajes.jsx'
import { MarcoJuego } from './MarcoJuego.jsx'
import { Proximamente } from './Proximamente.jsx'
import { ResultadoRonda } from './ResultadoRonda.jsx'
import { SelectorSeries } from './SelectorSeries.jsx'
import { conPopularidad, grupoDeUnaSerie, personajeAlAzar, personajesDeSerie, personajesDeSeriesDistintas } from './cartas.js'
import { crearAzar } from './azar.js'

const pintar = (elemento) => renderToStaticMarkup(elemento)
const SILUETA = juegoPorSlug('silueta')

describe('MarcoJuego', () => {
  it('pinta el kanji, el nombre como h1, la descripción, la racha y el récord', () => {
    const html = pintar(
      <MarcoJuego juego={SILUETA} reglas={<ol><li>Mira la silueta.</li></ol>}>
        <p>zona</p>
      </MarcoJuego>,
    )
    expect(html).toContain('aria-labelledby="juego-titulo"')
    expect(html).toMatch(/<span lang="ja" class="juego-kanji" aria-hidden="true">影<\/span>/)
    expect(html).toMatch(/<h1 id="juego-titulo"[^>]*>Silueta<\/h1>/)
    expect(html).toContain(SILUETA.descripcion)
    expect(html).toContain('>Un sobre por ronda ganada</p>')
    expect(html).toMatch(/<dt>Racha<\/dt><dd class="cifra">0<\/dd>/)
    expect(html).toMatch(/<dt>Récord<\/dt><dd class="cifra">0<\/dd>/)
    expect(html).toContain('<summary class="reglas-boton">')
    expect(html).toContain('Mira la silueta.')
    expect(html).toContain('<p>zona</p>')
    expect(html).toMatch(/href="\/juegos"[^>]*>.*Todos los juegos/)
  })

  it('sin reglas no hay desplegable, sin recompensa no lo promete y admite estadísticas propias', () => {
    const html = pintar(
      <MarcoJuego juego={juegoPorSlug('ruleta')} estadisticas={[{ etiqueta: 'Giros', valor: 12 }]}>
        <p>zona</p>
      </MarcoJuego>,
    )
    expect(html).not.toContain('reglas-boton')
    expect(html).not.toContain('Un sobre por ronda')
    expect(html).toContain('>Por gusto, sin sobre</p>')
    expect(html).toMatch(/<dt>Giros<\/dt><dd class="cifra">12<\/dd>/)
    expect(html).not.toContain('<dt>Racha</dt>')
  })
})

describe('ResultadoRonda', () => {
  it('victoria: sello, título, puntos y el aviso del sobre con enlace a /sobres', () => {
    const html = pintar(<ResultadoRonda resultado="victoria" puntos={40} sobreGanado onOtraRonda={() => {}} />)
    expect(html).toContain('data-resultado="victoria"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('>勝<')
    expect(html).toContain('¡Acertaste!')
    expect(html).toMatch(/<span class="cifra">40<\/span> puntos/)
    expect(html).toContain('Has ganado un sobre extra.')
    expect(html).toMatch(/href="\/sobres"[^>]*>Ábrelo en Sobres/)
    expect(html).toContain('>Otra ronda<')
    expect(html).toMatch(/href="\/juegos"[^>]*>Volver a los juegos/)
  })

  it('derrota sin sobre ni botón de otra ronda, con título y texto propios', () => {
    const html = pintar(
      <ResultadoRonda resultado="derrota" titulo="Se acabó" texto="Era Frieren.">
        <p>detalle</p>
      </ResultadoRonda>,
    )
    expect(html).toContain('>負<')
    expect(html).toContain('Se acabó')
    expect(html).toContain('Era Frieren.')
    expect(html).toContain('<p>detalle</p>')
    expect(html).not.toContain('sobre extra')
    expect(html).not.toContain('Otra ronda')
    expect(html).not.toContain('punto')
  })
})

describe('buscadores', () => {
  it('el autocompletar es un combobox cerrado hasta que se escribe', () => {
    const html = pintar(
      <Autocompletar buscar={() => []} clave={(x) => x} principal={(x) => x} onElegir={() => {}} etiqueta="Buscar cosa" />,
    )
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-autocomplete="list"')
    expect(html).toMatch(/<ul [^>]*role="listbox"[^>]*hidden=""/)
    expect(html).toContain('>Buscar cosa</span>')
    expect(html).not.toContain('aria-activedescendant')
  })

  it('el buscador de personajes y el selector de series llevan sus etiquetas', () => {
    expect(pintar(<BuscadorPersonajes onElegir={() => {}} />)).toContain('>Buscar personaje</span>')
    expect(pintar(<SelectorSeries onElegir={() => {}} />)).toContain('>Buscar serie</span>')
  })
})

describe('Proximamente', () => {
  it('cada marcador de posición muestra el nombre y el kanji dentro del marco', () => {
    for (const juego of JUEGOS) {
      const html = pintar(<Proximamente juego={juego} />)
      expect(html).toContain('Próximamente')
      expect(html).toContain(`>${juego.kanji}</span>`)
      expect(html).toContain(`>${juego.nombre}</h1>`)
      expect(html).toContain('juego-cabecera')
    }
  })
})

describe('cartas: atajos sobre el catálogo', () => {
  it('solo personajes, agrupados por serie', () => {
    const rng = crearAzar(1)
    const akame = personajesDeSerie('akame-ga-kill')
    expect(akame.length).toBeGreaterThan(0)
    expect(akame.every((c) => c.animeId === 'akame-ga-kill' && !c.id.startsWith('e-'))).toBe(true)
    const grupo = grupoDeUnaSerie(4, rng)
    expect(grupo.personajes).toHaveLength(4)
    expect(new Set(grupo.personajes.map((c) => c.animeId))).toEqual(new Set([grupo.serie.id]))
    const distintos = personajesDeSeriesDistintas(5, rng, { excluirSeries: new Set([grupo.serie.id]) })
    expect(new Set(distintos.map((c) => c.animeId)).size).toBe(5)
    expect(distintos.some((c) => c.animeId === grupo.serie.id)).toBe(false)
    const uno = personajeAlAzar(rng, { excluir: new Set(catalogo.personajes.slice(1).map((c) => c.id)) })
    expect(uno.id).toBe(catalogo.personajes[0].id)
    // Sin dato de favoritos en el catálogo, la lista queda vacía en vez de romper.
    expect(Array.isArray(conPopularidad())).toBe(true)
  })
})
