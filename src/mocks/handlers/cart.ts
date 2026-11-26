import { HttpResponse } from 'msw'
import {
  AddCartItemInputSchema,
  MergeCartInputSchema,
  UpdateCartItemInputSchema,
  type Cart,
} from '@/contracts'
import { nextId } from '@/mocks/db'
import { cartOf, findEdition, requireEdition, toCart } from './domain'
import { fail, parseBody, requireUser, route } from './utils'

function availabilityConflict(editionId: string, available: number): never {
  fail(
    'AVAILABILITY_CONFLICT',
    available === 0 ? 'Esta edição está esgotada.' : `Só há ${available} unidade(s) disponível(is) desta edição.`,
    { details: { editionId, available } },
  )
}

const respond = (userId: string) => HttpResponse.json<Cart>(toCart(userId))

export const cartHandlers = [
  route('get', '/cart', ({ request }) => respond(requireUser(request).user.id)),

  route('post', '/cart/items', async ({ request }) => {
    const { user } = requireUser(request)
    const input = await parseBody(request, AddCartItemInputSchema)
    const { edition } = requireEdition(input.editionId, input.nftId)
    const cart = cartOf(user.id)
    const existing = cart.items.find((i) => i.editionId === input.editionId)
    const nextQty = (existing?.quantity ?? 0) + input.quantity
    if (nextQty > edition.available) availabilityConflict(edition.id, edition.available)
    if (existing) existing.quantity = nextQty
    else cart.items.push({ id: nextId('ci'), nftId: input.nftId, editionId: input.editionId, quantity: input.quantity })
    cart.version += 1
    return respond(user.id)
  }),

  route('patch', '/cart/items/:itemId', async ({ request, params }) => {
    const { user } = requireUser(request)
    const input = await parseBody(request, UpdateCartItemInputSchema)
    const cart = cartOf(user.id)
    const item = cart.items.find((i) => i.id === params.itemId)
    if (!item) fail('NOT_FOUND', 'Item não está no carrinho.')
    const { edition } = requireEdition(item.editionId)
    if (input.quantity > edition.available) availabilityConflict(edition.id, edition.available)
    item.quantity = input.quantity
    cart.version += 1
    return respond(user.id)
  }),

  route('delete', '/cart/items/:itemId', ({ request, params }) => {
    const { user } = requireUser(request)
    const cart = cartOf(user.id)
    const before = cart.items.length
    cart.items = cart.items.filter((i) => i.id !== params.itemId)
    if (cart.items.length !== before) cart.version += 1
    return respond(user.id)
  }),

  /** Soma o carrinho de convidado ao do usuário, limitando ao estoque. Itens inválidos/esgotados são ignorados. */
  route('post', '/cart/merge', async ({ request }) => {
    const { user } = requireUser(request)
    const input = await parseBody(request, MergeCartInputSchema)
    const cart = cartOf(user.id)
    for (const guest of input.items) {
      const found = findEdition(guest.editionId)
      if (!found || found.nft.id !== guest.nftId || found.edition.available === 0) continue
      const existing = cart.items.find((i) => i.editionId === guest.editionId)
      const qty = Math.min((existing?.quantity ?? 0) + guest.quantity, found.edition.available)
      if (existing) existing.quantity = qty
      else cart.items.push({ id: nextId('ci'), nftId: guest.nftId, editionId: guest.editionId, quantity: qty })
    }
    cart.version += 1
    return respond(user.id)
  }),
]
