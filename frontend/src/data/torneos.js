export const torneos = [
  {
    slug: 'shonen-showdown',
    nombre: 'Shōnen Showdown',
    estado: 'en-curso',
    fechaInicio: '2026-05-07',
    fechaFin: null,
    participantes: [
      'naruto',
      'sasuke',
      'luffy',
      'zoro',
      'ichigo',
      'gojo',
      'itadori',
      'sukuna',
    ],
    winner: null,
  },
  {
    slug: 'best-girls-2026',
    nombre: 'Best Girls 2026',
    estado: 'finalizado',
    fechaInicio: '2026-04-14',
    fechaFin: '2026-04-28',
    participantes: [
      'mai_sakurajima',
      'marin_kitagawa',
      'frieren',
      'makima',
      'rem_and_ram',
      'asuna',
      'anya_forger',
      'mikasa',
    ],
    winner: 'makima',
  },
  {
    slug: 'slayers-vs-sorcerers',
    nombre: 'Slayers vs Sorcerers',
    estado: 'proximo',
    fechaInicio: '2026-05-12',
    fechaFin: null,
    participantes: [
      'nezuko',
      'zenitsu_agatsuma',
      'inosuke',
      'shinobu',
      'rengoku',
      'mitsuri_kanroji',
      'tomioka',
      'kanao_tsuyuri',
      'gojo',
      'itadori',
      'sukuna',
      'nobara',
      'yuta_okkotsu',
      'megumin',
      'levi',
      'kurumi',
    ],
    winner: null,
  },
  {
    slug: 'darkness-bracket',
    nombre: 'Darkness Bracket',
    estado: 'en-curso',
    fechaInicio: '2026-05-09',
    fechaFin: null,
    participantes: [
      'light_yagami',
      'makima',
      'sukuna',
      'esdeath',
      'L',
      'kaneki',
      'levi',
      'kurumi',
    ],
    winner: null,
  },
]

export function getTorneoBySlug(slug) {
  return torneos.find((t) => t.slug === slug) ?? null
}

export const estadoBadge = {
  'en-curso': {
    label: 'En curso',
    dot: 'bg-emerald-400',
    color: 'text-emerald-400',
  },
  finalizado: {
    label: 'Finalizado',
    dot: 'bg-fg-muted',
    color: 'text-fg-muted',
  },
  proximo: {
    label: 'Próximamente',
    dot: 'bg-accent',
    color: 'text-accent',
  },
}
