import { delay, HttpResponse } from 'msw'
import { CreateOrderInputSchema, IDEMPOTENCY_HEADER, type Order, type Receipt } from '@/contracts'
import { db, nextId, persist } from '@/mocks/db'
import type { OrderRecord } from '@/mocks/db'
import { getScenario, ORDER_TIMEOUT_HANG_MS, orderSettleDelayMs, SOCKET_OUTAGE_MS } from '@/mocks/scenarios'
import { dropConnections } from '@/mocks/socket'
import { updateEdition } from './domain'
import { scheduleSettlement } from './order-engine'
import { assertAvailable, priceLines } from './quote'
import { fail, parseBody, requireUser, route } from './utils'

/** JSON com chaves ordenadas — base da comparação "mesma key + mesmo payload". */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

const userOrders = (userId: string) => Object.values(db().orders).filter((o) => o.userId === userId)

export const ordersHandlers = [
  route('post', '/orders', async ({ request }) => {
    const { user } = requireUser(request)
    const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim()
    if (!key || key.length > 128) {
      fail('VALIDATION_ERROR', `Header ${IDEMPOTENCY_HEADER} é obrigatório.`, {
        fields: { [IDEMPOTENCY_HEADER]: 'Obrigatório (até 128 caracteres).' },
      })
    }
    const input = await parseBody(request, CreateOrderInputSchema)
    const payload = stableStringify(input)

    // Idempotência: mesma key + mesmo payload → mesmo pedido; payload diferente → 409.
    const existing = userOrders(user.id).find((o) => o.idempotencyKey === key)
    if (existing) {
      if (existing.payload !== payload) {
        fail('CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
      }
      return HttpResponse.json<Order>(existing.order, { status: 200 })
    }

    const quoteRec = db().quotes[input.quoteId]
    if (!quoteRec || (quoteRec.userId !== null && quoteRec.userId !== user.id)) {
      fail('QUOTE_OUTDATED', 'Cotação não encontrada. Atualize o resumo do pedido.')
    }
    if (quoteRec.quote.version !== input.quoteVersion || Date.parse(quoteRec.quote.expiresAt) <= Date.now()) {
      fail('QUOTE_OUTDATED', 'A cotação expirou ou mudou. Revise os valores.')
    }
    const current = priceLines(quoteRec.quote.lines.map(({ editionId, quantity }) => ({ editionId, quantity })))
    if (current.missing.length > 0 || current.fingerprint !== quoteRec.fingerprint) {
      fail('QUOTE_OUTDATED', 'Preço ou disponibilidade mudou desde a cotação. Revise os valores.')
    }
    assertAvailable(current.soldOut)

    const wallet = db().wallets[user.id]?.find((w) => w.id === input.walletId)
    if (!wallet) fail('VALIDATION_ERROR', 'Carteira inválida.', { fields: { walletId: 'Selecione uma carteira sua.' } })
    if (wallet.network !== input.network) {
      fail('VALIDATION_ERROR', 'A carteira não pertence a esta rede.', { fields: { network: 'Rede diferente da carteira.' } })
    }

    if (getScenario() === 'sold-out') {
      // Outra pessoa comprou a última unidade no meio do checkout.
      const first = current.lines[0]!
      updateEdition(first.line.editionId, { available: 0 })
      fail('AVAILABILITY_CONFLICT', 'Uma das edições esgotou durante a compra.', {
        details: { editionIds: [first.line.editionId] },
      })
    }

    const q = quoteRec.quote
    const snapshot: Receipt = {
      lines: current.lines.map(({ found: { nft, edition }, line }) => ({
        nftId: nft.id,
        editionId: edition.id,
        title: nft.title,
        editionLabel: edition.label,
        image: nft.images[0]!.src,
        imageAlt: nft.images[0]!.alt,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
      })),
      subtotal: q.subtotal,
      discount: q.discount,
      networkFee: q.networkFee,
      total: q.total,
      coupon: quoteRec.couponCode,
      wallet: { id: wallet.id, label: wallet.label, address: wallet.address },
      network: input.network,
      collector: input.collector,
    }

    // Reserva o estoque; devolvido se o pagamento for recusado.
    const reservations = current.lines.map(({ found: { nft, edition }, line }) => {
      updateEdition(edition.id, { available: edition.available - line.quantity })
      return { nftId: nft.id, editionId: edition.id, quantity: line.quantity }
    })

    const rec: OrderRecord = {
      order: {
        id: nextId('ord'),
        status: 'pending',
        transactionId: null,
        rejectionReason: null,
        receipt: null,
        createdAt: new Date().toISOString(),
        version: 1,
      },
      userId: user.id,
      idempotencyKey: key,
      payload,
      network: input.network,
      resolveAt: new Date(Date.now() + orderSettleDelayMs()).toISOString(),
      outcome: getScenario() === 'payment-declined' ? 'rejected' : 'confirmed',
      held: getScenario() === 'order-hold',
      snapshot,
      reservations,
    }
    db().orders[rec.order.id] = rec
    persist()
    scheduleSettlement(rec)

    if (getScenario() === 'socket-drop') {
      // Queda durante o pending: o order.updated é perdido; o cliente precisa reconciliar via REST ao reconectar.
      const userId = user.id
      setTimeout(() => dropConnections({ userId, outageMs: SOCKET_OUTAGE_MS }), 300)
    }

    if (getScenario() === 'order-timeout') {
      // O pedido JÁ existe; só a resposta não chega a tempo (cliente deve recuperar via /orders/by-key).
      await delay(ORDER_TIMEOUT_HANG_MS)
    }
    return HttpResponse.json<Order>(rec.order, { status: 202 })
  }),

  route('get', '/orders/by-key/:key', ({ request, params }) => {
    const { user } = requireUser(request)
    const rec = userOrders(user.id).find((o) => o.idempotencyKey === params.key)
    if (!rec) fail('NOT_FOUND', 'Nenhum pedido com esta chave.')
    return HttpResponse.json<Order>(rec.order)
  }),

  route('get', '/orders/:id', ({ request, params }) => {
    const { user } = requireUser(request)
    const rec = db().orders[params.id ?? '']
    if (!rec) fail('NOT_FOUND', 'Pedido não encontrado.')
    if (rec.userId !== user.id) fail('FORBIDDEN', 'Este pedido pertence a outra conta.')
    return HttpResponse.json<Order>(rec.order)
  }),
]
