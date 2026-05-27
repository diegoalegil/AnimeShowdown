import Skeleton from '../../../components/Skeleton'

function CatalogoSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  )
}

export default CatalogoSkeletonGrid
