export type Nullable<T> = T | null

export type PersonajeLite = {
  slug: string
  nombre: string
  anime?: string
  imagen?: string
  [key: string]: unknown
}

export type LocalVote = {
  id: string
  at: string
  date: string
  ganadorSlug: string
  ganadorNombre: string
  ganadorAnime: string
  perdedorSlug: string
  perdedorNombre: string
  perdedorAnime: string
  source: string
}

export type ShareResult = 'native' | 'clipboard' | 'cancelled'
