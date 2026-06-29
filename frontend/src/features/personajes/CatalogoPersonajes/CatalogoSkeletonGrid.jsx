import './catalogo-archivo.css'

/* Skeleton con la silueta de la ficha de archivador (pestaña 22px +
   arte 2:3) para que loading → loaded no recalcule el layout. Piel
   .skl de la casa.

   Cantidad = 18: el catálogo carga PAGE_SIZE=60, así que la rejilla cargada
   llena varias pantallas. Con 12 ghosts a 6 columnas (lg) solo se pintaban
   2 filas → el pliegue quedaba vacío durante la carga y la página parecía
   lenta/rota. 18 da 3 filas a 6 col (desktop), 4.5 a md, 6 a sm y 9 a 2 col
   (móvil): llena el pliegue en todos los breakpoints. Mismas clases de rejilla
   que el grid real (anti-CLS); los ghosts son transform-only y mueren al
   hidratar, sin coste sostenido. */
function CatalogoSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i}>
          <div className="cat-ficha-skl__tab">
            <span className="skl cat-ficha-skl__lengueta block" />
          </div>
          <div className="skl cat-ficha-skl__arte" />
        </div>
      ))}
    </div>
  )
}

export default CatalogoSkeletonGrid
