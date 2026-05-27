export function miTop5Schema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Mi Top 5 anime — AnimeShowdown',
    url: 'https://animeshowdown.dev/mi-top5',
    applicationCategory: 'EntertainmentApplication',
    operatingSystem: 'Web',
    inLanguage: 'es-ES',
    description:
      'Generador gratuito para crear una imagen compartible con los cinco personajes anime favoritos del usuario.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'AnimeShowdown',
      url: 'https://animeshowdown.dev/',
    },
    featureList: [
      'Seleccionar cinco personajes anime',
      'Rellenar el Top 5 desde el ranking personal local',
      'Exportar una imagen PNG 1200x630',
      'Compartir el resultado en redes o copiar el texto',
    ],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
  }
}
