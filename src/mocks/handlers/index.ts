import { HttpResponse } from 'msw'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { catalogHandlers } from './catalog'
import { favoritesHandlers } from './favorites'
import { ordersHandlers } from './orders'
import { profileHandlers, walletHandlers } from './profile'
import { quoteHandlers } from './quote'
import { route } from './utils'

export const handlers = [
  route('get', '/health', () => HttpResponse.json({ status: 'ok', mock: true })),
  ...authHandlers,
  ...catalogHandlers,
  ...favoritesHandlers,
  ...cartHandlers,
  ...quoteHandlers,
  ...ordersHandlers,
  ...profileHandlers,
  ...walletHandlers,
]
