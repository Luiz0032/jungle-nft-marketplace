import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CreateOrderInput, Order, Quote, QuoteInput } from '@/contracts'
import { createOrder, fetchOrderByKey } from '@/features/orders/api'
import { quoteQuery } from '@/features/quote/queries'
import { isApiError, type ApiRequestError } from '@/lib/http'
import { attempts, type Attempt } from '@/lib/idempotency'
import { notify } from '@/lib/notify'
import { queryKeys } from '@/lib/query-keys'

/** Tudo que o usuário revisou numa cotação: se algo disso mudar, ele precisa confirmar de novo. */
export function quoteSignature(q: Quote) {
  return JSON.stringify([
    q.lines.map((l) => [l.editionId, l.unitPrice, l.quantity]),
    q.subtotal,
    q.discount,
    q.networkFee,
    q.total,
    q.coupon?.code ?? null,
  ])
}

export type Phase =
  | { kind: 'idle' }
  | { kind: 'revalidating' }
  | { kind: 'submitting' }
  | { kind: 'recovering' }
  /** Sem resposta e sem pedido encontrado pela chave: reenviar usa a MESMA chave. */
  | { kind: 'unresolved'; notFound: boolean }
  | { kind: 'failed'; message: string; backToCart: boolean }

const RECOVERY_TRIES = 3
const RECOVERY_GAP_MS = 1_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Falha sem saber se o servidor criou o pedido (não descarta a chave). */
const unknownOutcome = (e: unknown) =>
  !isApiError(e) ||
  ['TIMEOUT', 'NETWORK_ERROR', 'TRANSIENT', 'UNKNOWN', 'INVALID_RESPONSE'].includes(e.code) ||
  (e.status ?? 0) >= 500

/**
 * Envio do pedido (ARCHITECTURE §7.1). Antes de criar a tentativa revalida a cotação; mudou → não envia e pede
 * reconfirmação. Uma `Idempotency-Key` por tentativa (src/lib/idempotency.ts). Timeout/rede → procura o pedido
 * por `GET /orders/by-key/:key`; sem resposta conclusiva, reenviar reaproveita a mesma chave e o mesmo payload.
 */
export function usePlaceOrder({
  userId,
  scope,
  quoteInput,
  accepted,
}: {
  userId: string
  scope: string
  quoteInput: QuoteInput
  accepted: Quote | null
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // Refresh com tentativa em aberto sem pedido: já começa procurando pela chave.
  const [phase, setPhase] = useState<Phase>(() => {
    const open = attempts.get(userId)
    return open && !open.orderId ? { kind: 'recovering' } : { kind: 'idle' }
  })
  const busy = useRef(false)

  const goToOrder = useCallback(
    (attempt: Attempt, order: Order) => {
      attempts.recordOrder(userId, attempt.key, order.id)
      queryClient.setQueryData(queryKeys.order(userId, order.id), order)
      setPhase({ kind: 'idle' })
      void navigate({ to: '/orders/$id', params: { id: order.id }, replace: true })
    },
    [navigate, queryClient, userId],
  )

  /** Procura o pedido pela chave (o chamador já pôs a fase em `recovering`). */
  const lookup = useCallback(
    async (attempt: Attempt) => {
      let notFound = false
      for (let i = 0; i < RECOVERY_TRIES; i++) {
        try {
          const order = await fetchOrderByKey(attempt.key)
          goToOrder(attempt, order)
          return
        } catch (e) {
          if (isApiError(e, 'NOT_FOUND')) {
            notFound = true
            break
          }
          await sleep(RECOVERY_GAP_MS)
        }
      }
      setPhase({ kind: 'unresolved', notFound })
      notify.error('Não conseguimos confirmar se o pedido foi criado. Você pode reenviar com segurança.')
    },
    [goToOrder],
  )

  const recover = useCallback(
    async (attempt: Attempt) => {
      setPhase({ kind: 'recovering' })
      await lookup(attempt)
    },
    [lookup],
  )

  const send = useCallback(
    async (attempt: Attempt) => {
      setPhase({ kind: 'submitting' })
      try {
        goToOrder(attempt, await createOrder(attempt.input, attempt.key))
      } catch (e) {
        if (unknownOutcome(e)) {
          await recover(attempt)
          return
        }
        // Recusa definitiva: o pedido não foi criado; a chave não serve mais.
        attempts.discard(userId, attempt.key)
        const err = e as ApiRequestError
        if (err.code === 'QUOTE_OUTDATED') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.quotes() })
          setPhase({ kind: 'failed', message: `${err.message} Confira os novos valores e confirme de novo.`, backToCart: false })
        } else if (err.code === 'AVAILABILITY_CONFLICT') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.quotes() })
          void queryClient.invalidateQueries({ queryKey: queryKeys.cart(userId) })
          setPhase({ kind: 'failed', message: `${err.message} Ajuste o carrinho para continuar.`, backToCart: true })
        } else {
          setPhase({ kind: 'failed', message: err.message, backToCart: false })
        }
        notify.error(err.message)
      }
    },
    [goToOrder, queryClient, recover, userId],
  )

  // Refresh no meio do envio: tentativa em aberto → pedido já criado vai direto; sem pedido, procura pela chave.
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current) return
    resumed.current = true
    const open = attempts.get(userId)
    if (!open) return
    if (open.orderId) {
      void navigate({ to: '/orders/$id', params: { id: open.orderId }, replace: true })
      return
    }
    busy.current = true
    void Promise.resolve()
      .then(() => lookup(open)) // assíncrono: a fase inicial já é `recovering`
      .finally(() => {
      busy.current = false
    })
  }, [navigate, lookup, userId])

  const confirm = useCallback(
    async (details: Omit<CreateOrderInput, 'quoteId' | 'quoteVersion'>) => {
      if (busy.current) return // cliques repetidos
      busy.current = true
      try {
        const open = attempts.get(userId)
        if (open) {
          await send(open) // reenvio: mesma chave, mesmo payload
          return
        }
        if (!accepted) return
        setPhase({ kind: 'revalidating' })
        let fresh: Quote
        try {
          fresh = await queryClient.fetchQuery({ ...quoteQuery(scope, quoteInput), staleTime: 0 })
        } catch (e) {
          const message = isApiError(e) ? e.message : 'Não foi possível revalidar os valores.'
          const backToCart = isApiError(e, 'AVAILABILITY_CONFLICT')
          setPhase({ kind: 'failed', message: backToCart ? `${message} Ajuste o carrinho para continuar.` : message, backToCart })
          notify.error(message)
          return
        }
        if (quoteSignature(fresh) !== quoteSignature(accepted)) {
          setPhase({ kind: 'idle' }) // a tela mostra o que mudou e pede reconfirmação
          notify.info('Os valores mudaram desde a revisão. Confira e confirme de novo.')
          return
        }
        const attempt = attempts.begin(userId, { ...details, quoteId: fresh.id, quoteVersion: fresh.version })
        await send(attempt)
      } finally {
        busy.current = false
      }
    },
    [accepted, queryClient, quoteInput, scope, send, userId],
  )

  /** Só depois que a busca pela chave disse "não existe": descartar é seguro. */
  const discardOpen = useCallback(() => {
    const open = attempts.get(userId)
    if (open && !open.orderId) attempts.discard(userId, open.key)
    setPhase({ kind: 'idle' })
  }, [userId])

  return { phase, confirm, discardOpen, clearFailure: () => setPhase({ kind: 'idle' }) }
}
