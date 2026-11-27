import { queryOptions, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Cart, Eth, NftDetail } from '@/contracts'
import { useCurrentUser } from '@/features/auth/hooks'
import { nftDetailQuery } from '@/features/nft/queries'
import { isApiError } from '@/lib/http'
import { notify } from '@/lib/notify'
import { queryKeys } from '@/lib/query-keys'
import { addCartItem, fetchCart, removeCartItem, updateCartItem } from './api'
import { guestCart, useGuestCart } from './guest-cart'

export const cartQuery = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.cart(userId),
    queryFn: ({ signal }) => fetchCart(signal),
    staleTime: 0,
    retry: (count, error) => count < 1 && !isApiError(error, 'UNAUTHENTICATED') && !isApiError(error, 'SESSION_EXPIRED'),
  })

/** Linha do carrinho na tela — mesma forma para convidado e usuário. `key` = editionId (uma linha por edição). */
export type CartLine = {
  key: string
  /** Id do item no servidor (só usuário logado). */
  itemId: string | null
  nftId: string
  editionId: string
  title: string
  editionLabel: string
  image: string
  imageAlt: string
  unitPrice: Eth
  quantity: number
  available: number
}

export type CartView = {
  /** `userId` ou `'guest'` — escopo de cotação/cupom. */
  scope: string
  userId: string | null
  status: 'pending' | 'error' | 'success'
  lines: CartLine[]
  /** Soma das quantidades (badge do header). */
  count: number
  isFetching: boolean
  refetch: () => void
  /** Itens de convidado que não puderam ser juntados ao carrinho da conta. */
  mergeFailed: boolean
}

const fromServer = (cart: Cart): CartLine[] => cart.items.map((i) => ({ ...i, key: i.editionId, itemId: i.id }))

/**
 * Carrinho atual. Logado: GET /cart (`['user', userId, 'cart']`). Convidado: itens do localStorage +
 * detalhe de cada NFT pela API (preço/estoque reais e atualizados por `nft.updated`).
 * Enquanto a fusão do login está em voo o carrinho do usuário espera (evita mostrar o carrinho sem os itens).
 */
export function useCart(): CartView {
  const user = useCurrentUser()
  const guest = useGuestCart()
  const waitingMerge = Boolean(user) && guest.items.length > 0 && guest.merge !== 'error'

  const server = useQuery({ ...cartQuery(user?.id ?? ''), enabled: Boolean(user) && !waitingMerge })

  const nftIds = user ? [] : [...new Set(guest.items.map((i) => i.nftId))]
  const details = useQueries({ queries: nftIds.map((id) => nftDetailQuery(id)) })

  if (user) {
    const lines = server.data ? fromServer(server.data) : []
    return {
      scope: user.id,
      userId: user.id,
      status: waitingMerge || server.isPending ? 'pending' : server.isError && !server.data ? 'error' : 'success',
      lines,
      count: lines.reduce((acc, l) => acc + l.quantity, 0),
      isFetching: server.isFetching,
      refetch: () => void server.refetch(),
      mergeFailed: guest.items.length > 0 && guest.merge === 'error',
    }
  }

  const byId = new Map<string, NftDetail>()
  details.forEach((q, idx) => q.data && byId.set(nftIds[idx]!, q.data))
  // NFT/edição que deixou de existir (404) não aparece (a fusão no login também o ignora).
  const lines = guest.items.flatMap((item): CartLine[] => {
    const nft = byId.get(item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) return []
    return [
      {
        key: item.editionId,
        itemId: null,
        nftId: nft.id,
        editionId: edition.id,
        title: nft.title,
        editionLabel: edition.label,
        image: nft.images[0]!.src,
        imageAlt: nft.images[0]!.alt,
        unitPrice: edition.price,
        quantity: item.quantity,
        available: edition.available,
      },
    ]
  })
  const failed = details.some((q) => q.isError && !isApiError(q.error, 'NOT_FOUND'))
  return {
    scope: 'guest',
    userId: null,
    status: details.some((q) => q.isPending) ? 'pending' : failed ? 'error' : 'success',
    lines,
    count: guest.items.reduce((acc, i) => acc + i.quantity, 0),
    isFetching: details.some((q) => q.isFetching),
    refetch: () => {
      for (const q of details) if (q.isError) void q.refetch()
    },
    mergeFailed: false,
  }
}

const conflictMessage = (error: unknown, fallback: string) =>
  isApiError(error, 'AVAILABILITY_CONFLICT') ? error.message : fallback

type AddVars = { nftId: string; editionId: string; quantity: number; title: string; available: number }

/** Adicionar ao carrinho (detalhe do NFT). Convidado: localStorage; usuário: POST /cart/items (409 se passar do estoque). */
export function useAddToCart() {
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ nftId, editionId, quantity, available }: AddVars): Promise<void> => {
      if (!user) {
        const result = guestCart.add({ nftId, editionId, quantity }, available)
        if (!result.ok) {
          throw new Error(
            available === 0
              ? 'Esta edição está esgotada.'
              : `Só há ${available} unidade(s) disponível(is) desta edição (contando o que já está no carrinho).`,
          )
        }
        return
      }
      const cart = await addCartItem({ nftId, editionId, quantity })
      queryClient.setQueryData(queryKeys.cart(user.id), cart)
    },
    onSuccess: (_d, { title, quantity }) =>
      notify.success(`${quantity} ${quantity === 1 ? 'unidade' : 'unidades'} de ${title} no carrinho.`),
    onError: (error, { title }) =>
      notify.error(
        isApiError(error, 'AVAILABILITY_CONFLICT') || !isApiError(error)
          ? error.message
          : `Não foi possível adicionar ${title} ao carrinho. Tente de novo.`,
      ),
  })
}

type QtyVars = { line: CartLine; quantity: number }

/**
 * Alterar quantidade e remover — otimistas. Convidado: síncrono no localStorage. Usuário: `cancelQueries` →
 * snapshot → `setQueryData`; erro → snapshot de volta + toast/aria-live. Com várias mutações em voo, só a
 * última reconcilia com o servidor (evita o "pisca" de respostas intermediárias).
 */
export function useCartMutations() {
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const key = queryKeys.cart(user?.id ?? '')
  const mutationKey = ['cart-edit', user?.id ?? 'guest'] as const

  async function optimistic(change: (cart: Cart) => Cart) {
    await queryClient.cancelQueries({ queryKey: key })
    const previous = queryClient.getQueryData<Cart>(key)
    if (previous) queryClient.setQueryData<Cart>(key, change(previous))
    return { previous }
  }
  const rollback = (context: { previous: Cart | undefined } | undefined) => {
    if (context?.previous) queryClient.setQueryData(key, context.previous)
  }
  const settle = (cart: Cart | undefined) => {
    if (queryClient.isMutating({ mutationKey }) > 1) return
    if (cart) queryClient.setQueryData(key, cart)
    void queryClient.invalidateQueries({ queryKey: key })
  }

  const update = useMutation({
    mutationKey,
    mutationFn: ({ line, quantity }: QtyVars) =>
      user && line.itemId ? updateCartItem(line.itemId, quantity) : Promise.resolve(undefined),
    onMutate: async ({ line, quantity }) => {
      if (!user) {
        guestCart.update(line.editionId, quantity)
        return { previous: undefined }
      }
      return optimistic((cart) => ({
        ...cart,
        items: cart.items.map((i) => (i.id === line.itemId ? { ...i, quantity } : i)),
      }))
    },
    onError: (error, { line }, context) => {
      rollback(context)
      notify.error(conflictMessage(error, `Não foi possível alterar a quantidade de ${line.title}. Tente de novo.`))
    },
    onSettled: (cart) => {
      if (user) settle(cart)
    },
  })

  const remove = useMutation({
    mutationKey,
    mutationFn: ({ line }: { line: CartLine }) =>
      user && line.itemId ? removeCartItem(line.itemId) : Promise.resolve(undefined),
    onMutate: async ({ line }) => {
      if (!user) {
        guestCart.remove(line.editionId)
        return { previous: undefined }
      }
      return optimistic((cart) => ({ ...cart, items: cart.items.filter((i) => i.id !== line.itemId) }))
    },
    onError: (_e, { line }, context) => {
      rollback(context)
      notify.error(`Não foi possível remover ${line.title} do carrinho. Tente de novo.`)
    },
    onSuccess: (_d, { line }) => notify.success(`${line.title} (${line.editionLabel}) removido do carrinho.`),
    onSettled: (cart) => {
      if (user) settle(cart)
    },
  })

  return { update, remove }
}
