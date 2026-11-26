import type { Query, QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import {
  REALTIME_EVENT_TYPES,
  RealtimeEventSchema,
  TERMINAL_ORDER_STATUSES,
  type Edition,
  type NftDetail,
  type NftSummary,
  type NftUpdatedEvent,
  type Order,
  type OrderUpdatedEvent,
  type Page,
  type RealtimeEvent,
} from '@/contracts'
import { min } from '@/lib/money'
import { isUserScoped, queryKeys } from '@/lib/query-keys'

/**
 * Aplica eventos do Socket.IO no cache do TanStack Query (ARCHITECTURE §5). Regras:
 * 1. descarta `eventId` já visto (LRU);
 * 2. descarta `version <= última aplicada` do recurso (e versão ≤ à do cache vindo do REST);
 * 3. descarta evento privado de outro usuário;
 * 4. pedido em estado terminal nunca muda;
 * 5. ao reconectar, refaz via REST as queries ativas e pedidos pendentes (eventos perdidos na queda);
 * + eventos de um socket anterior (sessão antiga) são ignorados e listeners são removidos no detach.
 */

const SEEN_LIMIT = 500

export type RealtimeListener = (event: RealtimeEvent) => void

export type Realtime = ReturnType<typeof createRealtime>

/** Resumo de NFT a partir das edições (só exibição; mesma regra do contrato `NftSummary.price`). */
function summarize(editions: Edition[]): Pick<NftSummary, 'price' | 'available'> {
  const inStock = editions.filter((e) => e.available > 0)
  const pool = inStock.length > 0 ? inStock : editions
  return {
    price: pool.map((e) => e.price).reduce((a, b) => min(a, b)),
    available: editions.reduce((acc, e) => acc + e.available, 0),
  }
}

const isTerminal = (status: Order['status']) => TERMINAL_ORDER_STATUSES.includes(status)

export function createRealtime({
  queryClient,
  getUserId,
}: {
  queryClient: QueryClient
  getUserId: () => string | null
}) {
  const seen = new Map<string, true>()
  const lastVersion = new Map<string, number>()
  const listeners = new Set<RealtimeListener>()
  let current: Socket | null = null
  let epoch = 0
  let detachCurrent: (() => void) | null = null

  function remember(eventId: string) {
    seen.set(eventId, true)
    if (seen.size > SEEN_LIMIT) seen.delete(seen.keys().next().value!)
  }

  function applyNft(e: NftUpdatedEvent): boolean {
    const { nftId, editionId, price, available } = e.payload
    const detailKey = queryKeys.nfts.detail(nftId)
    let stale = false

    queryClient.setQueryData<NftDetail>(detailKey, (old) => {
      if (!old) return old
      if (!editionId) return { ...old, price: price ?? old.price, available: available ?? old.available }
      const edition = old.editions.find((x) => x.id === editionId)
      if (!edition) return old
      if (edition.version >= e.version) {
        stale = true // REST já trouxe estado igual ou mais novo
        return old
      }
      const editions = old.editions.map((x) =>
        x.id === editionId
          ? { ...x, price: price ?? x.price, available: available ?? x.available, version: e.version }
          : x,
      )
      return { ...old, editions, ...summarize(editions) }
    })
    if (stale) return false

    const detail = queryClient.getQueryData<NftDetail>(detailKey)
    const listKey = queryKeys.nfts.lists()
    if (detail) {
      queryClient.setQueriesData<Page<NftSummary>>({ queryKey: listKey }, (page) =>
        page && {
          ...page,
          items: page.items.map((i) => (i.id === nftId ? { ...i, price: detail.price, available: detail.available } : i)),
        },
      )
    } else {
      // Sem o detalhe não dá para recalcular o menor preço: refaz só as listas que contêm o NFT.
      void queryClient.invalidateQueries({
        queryKey: listKey,
        predicate: (q: Query) => (q.state.data as Page<NftSummary> | undefined)?.items.some((i) => i.id === nftId) ?? false,
      })
    }
    void queryClient.invalidateQueries({ predicate: isUserScoped('cart') })
    // Cotação nunca é reaproveitada depois de uma mudança de preço/estoque.
    void queryClient.invalidateQueries({ queryKey: queryKeys.quotes() })
    return true
  }

  function applyOrder(e: OrderUpdatedEvent): boolean {
    const userId = getUserId()
    if (!userId) return false
    const key = queryKeys.order(userId, e.payload.orderId)
    const cached = queryClient.getQueryData<Order>(key)
    if (cached) {
      if (isTerminal(cached.status) || cached.version >= e.version) return false
      queryClient.setQueryData<Order>(key, {
        ...cached,
        status: e.payload.status,
        transactionId: e.payload.transactionId ?? cached.transactionId,
        rejectionReason: e.payload.rejectionReason ?? cached.rejectionReason,
        version: e.version,
      })
    }
    // Recibo e dados completos vêm do REST.
    if (isTerminal(e.payload.status)) {
      void queryClient.invalidateQueries({ queryKey: key })
      // Confirmado: o servidor tirou do carrinho os itens comprados.
      if (e.payload.status === 'confirmed') void queryClient.invalidateQueries({ queryKey: queryKeys.cart(userId) })
    }
    return true
  }

  function handle(raw: unknown, socketEpoch: number) {
    if (socketEpoch !== epoch) return
    const parsed = RealtimeEventSchema.safeParse(raw)
    if (!parsed.success) {
      if (import.meta.env.DEV) console.warn('[realtime] evento fora do contrato', parsed.error)
      return
    }
    const e = parsed.data
    if (seen.has(e.eventId)) return
    remember(e.eventId)
    const resourceKey = `${e.resource.type}:${e.resource.id}`
    if (e.version <= (lastVersion.get(resourceKey) ?? -1)) return
    if (e.userId !== null && e.userId !== getUserId()) return

    const applied = e.type === 'nft.updated' ? applyNft(e) : applyOrder(e)
    if (!applied) return
    lastVersion.set(resourceKey, e.version)
    for (const l of listeners) l(e)
  }

  /** Reconciliação após queda: eventos emitidos enquanto desconectado foram perdidos. */
  function reconcile() {
    void queryClient.refetchQueries({ type: 'active' })
    void queryClient.refetchQueries({
      predicate: (q: Query) => isUserScoped('orders')(q) && (q.state.data as Order | undefined)?.status === 'pending',
    })
  }

  return {
    /** Liga a um socket (ou `null` para desligar). Remove os listeners do anterior. */
    attach(socket: Socket | null) {
      if (socket === current) return
      detachCurrent?.()
      detachCurrent = null
      epoch += 1
      current = socket
      if (!socket) return
      const myEpoch = epoch
      const onEvent = (raw: unknown) => handle(raw, myEpoch)
      for (const type of REALTIME_EVENT_TYPES) socket.on(type, onEvent)
      socket.io.on('reconnect', reconcile)
      detachCurrent = () => {
        for (const type of REALTIME_EVENT_TYPES) socket.off(type, onEvent)
        socket.io.off('reconnect', reconcile)
      }
    },
    /** Eventos efetivamente aplicados (para toast + aria-live). */
    subscribe(listener: RealtimeListener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Troca de usuário: esquece versões/ids vistos. */
    reset() {
      seen.clear()
      lastVersion.clear()
    },
  }
}
