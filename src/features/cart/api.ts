import { CartSchema, type AddCartItemInput, type GuestItem } from '@/contracts'
import { request } from '@/lib/http'

export const fetchCart = (signal?: AbortSignal) => request(CartSchema, { url: '/cart', signal })

export const addCartItem = (input: AddCartItemInput) =>
  request(CartSchema, { method: 'post', url: '/cart/items', data: input })

export const updateCartItem = (itemId: string, quantity: number) =>
  request(CartSchema, { method: 'patch', url: `/cart/items/${encodeURIComponent(itemId)}`, data: { quantity } })

export const removeCartItem = (itemId: string) =>
  request(CartSchema, { method: 'delete', url: `/cart/items/${encodeURIComponent(itemId)}` })

export const mergeCart = (items: GuestItem[]) => request(CartSchema, { method: 'post', url: '/cart/merge', data: { items } })
