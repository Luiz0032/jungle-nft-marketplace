import { FavoritesSchema } from '@/contracts'
import { request, requestVoid } from '@/lib/http'

export const fetchFavorites = (signal?: AbortSignal) => request(FavoritesSchema, { url: '/favorites', signal })

export const addFavorite = (nftId: string) =>
  requestVoid({ method: 'put', url: `/favorites/${encodeURIComponent(nftId)}` })

export const removeFavorite = (nftId: string) =>
  requestVoid({ method: 'delete', url: `/favorites/${encodeURIComponent(nftId)}` })
