import { HttpResponse } from 'msw'
import type { Favorites } from '@/contracts'
import { db } from '@/mocks/db'
import { findNft } from './domain'
import { fail, noContent, requireUser, route } from './utils'

const favoritesOf = (userId: string) => (db().favorites[userId] ??= [])

export const favoritesHandlers = [
  route('get', '/favorites', ({ request }) => {
    const { user } = requireUser(request)
    return HttpResponse.json<Favorites>({ nftIds: favoritesOf(user.id) })
  }),

  route('put', '/favorites/:nftId', ({ request, params }) => {
    const { user } = requireUser(request)
    const nftId = params.nftId ?? ''
    if (!findNft(nftId)) fail('NOT_FOUND', 'NFT não encontrado.')
    const list = favoritesOf(user.id)
    if (!list.includes(nftId)) list.push(nftId) // idempotente
    return noContent()
  }),

  route('delete', '/favorites/:nftId', ({ request, params }) => {
    const { user } = requireUser(request)
    db().favorites[user.id] = favoritesOf(user.id).filter((id) => id !== params.nftId)
    return noContent()
  }),
]
