import Placeholder from '../components/Placeholder'

function NotFoundPage() {
  return (
    <Placeholder
      eyebrow="Error 404"
      titulo="Página no encontrada"
      descripcion="La página que buscas no existe o se ha movido. Vuelve al inicio para seguir explorando torneos y personajes."
      cta={{ to: '/', label: 'Volver al inicio' }}
    />
  )
}

export default NotFoundPage
