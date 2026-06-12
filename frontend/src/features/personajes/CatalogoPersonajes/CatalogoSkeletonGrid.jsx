import './catalogo-archivo.css'

/* Skeleton con la silueta de la ficha de archivador (pestaña 22px +
   arte 2:3) para que loading → loaded no recalcule el layout. Piel
   .skl de la casa. */
function CatalogoSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
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
