import type { PersonajeLite } from '../../lib/types'

// Fixture de personajes representativos para tests de personajes-core.
// NO importar el JSON real (1086 entries) — lentitud + flaky por cambios futuros.
export const personajesFixtures: PersonajeLite[] = [
  {
    slug: 'luffy',
    nombre: 'Monkey D. Luffy',
    anime: 'One Piece',
    imagen: 'https://assets.animeshowdown.dev/img/card/luffy.webp',
    imagenUrl: 'https://assets.animeshowdown.dev/img/card/luffy.webp',
  },
  {
    slug: 'goku',
    nombre: 'Goku',
    anime: 'Dragon Ball',
    imagen: 'https://assets.animeshowdown.dev/img/card/goku.webp',
    imagenUrl: 'https://assets.animeshowdown.dev/img/card/goku.webp',
  },
  {
    slug: 'naruto',
    nombre: 'Naruto Uzumaki',
    anime: 'Naruto',
    imagen: 'https://assets.animeshowdown.dev/img/card/naruto.webp',
    imagenUrl: 'https://assets.animeshowdown.dev/img/card/naruto.webp',
  },
  {
    slug: 'frieren',
    nombre: 'Frieren',
    anime: 'Frieren: Beyond Journey\'s End',
    imagen: 'https://assets.animeshowdown.dev/img/card/frieren.webp',
    imagenUrl: 'https://assets.animeshowdown.dev/img/card/frieren.webp',
  },
  {
    slug: 'allmight',
    nombre: 'All Might',
    anime: 'My Hero Academia',
    imagen: 'https://assets.animeshowdown.dev/img/card/allmight.webp',
    imagenUrl: 'https://assets.animeshowdown.dev/img/card/allmight.webp',
  },
  {
    slug: 'hinata',
    nombre: 'Hinata Hyuga',
    anime: 'Naruto',
    imagen: 'https://assets.animeshowdown.dev/img/card/hinata.webp',
    imagenUrl: 'https://assets.animeshowdown.dev/img/card/hinata.webp',
  },
  {
    slug: 'zoro',
    nombre: 'Roronoa Zoro',
    anime: 'One Piece',
    imagen: 'https://assets.animeshowdown.dev/img/card/zoro.webp',
    imagenUrl: 'https://assets.animeshowdown.dev/img/card/zoro.webp',
  },
  {
    slug: 'gojo',
    nombre: 'Satoru Gojo',
    anime: 'Jujutsu Kaisen',
    imagen: 'https://assets.animeshowdown.dev/img/card/gojo.webp',
    imagenUrl: 'https://assets.animeshowdown.dev/img/card/gojo.webp',
  },
]

// Fixture de torneo para tests de torneosQueries
export const torneoFixtures = {
  summary: {
    id: 1,
    slug: 'test-torneo',
    nombre: 'Test Tournament',
    estado: 'SCHEDULED',
  },
  detalle: {
    id: 1,
    slug: 'test-torneo',
    nombre: 'Test Tournament',
    estado: 'IN_PROGRESS',
    enfrentamientos: [],
  },
}