import { db, persist } from '@/mocks/db'
import type { OrderRecord } from '@/mocks/db'
import { publish } from '@/mocks/events'
import { randomHex } from '@/mocks/lib/crypto'
import { findEdition, updateEdition } from './domain'

/**
 * "Processamento de pagamento" do servidor mock. Um pedido nasce `pending` e é assentado
 * (confirmed/rejected) em `resolveAt` — por timer, ou preguiçosamente na próxima requisição
 * (cobre refresh da página antes do timer disparar). Estado terminal nunca muda.
 */
/**
 * Pedido confirmado: tira do carrinho SÓ o que foi comprado (quantidade a quantidade). O que o usuário
 * adicionou ou aumentou depois de enviar o pedido continua lá. Roda uma vez (settle só sai de `pending`).
 */
function removePurchasedFromCart(rec: OrderRecord) {
  const cart = db().carts[rec.userId]
  if (!cart) return
  for (const bought of rec.reservations) {
    const item = cart.items.find((i) => i.editionId === bought.editionId)
    if (!item) continue
    item.quantity -= bought.quantity
  }
  cart.items = cart.items.filter((i) => i.quantity > 0)
  cart.version += 1
}

function settle(rec: OrderRecord) {
  if (rec.order.status !== 'pending') return
  if (rec.outcome === 'confirmed') {
    rec.order = {
      ...rec.order,
      status: 'confirmed',
      transactionId: `0x${randomHex(32)}`,
      receipt: rec.snapshot,
      version: rec.order.version + 1,
    }
    removePurchasedFromCart(rec)
  } else {
    for (const r of rec.reservations) {
      const found = findEdition(r.editionId)
      if (found) updateEdition(r.editionId, { available: found.edition.available + r.quantity })
    }
    rec.order = {
      ...rec.order,
      status: 'rejected',
      rejectionReason: 'Pagamento recusado pela carteira.',
      version: rec.order.version + 1,
    }
  }
  publish({ type: 'order.changed', userId: rec.userId, order: rec.order })
}

export function settleDueOrders() {
  const now = Date.now()
  let changed = false
  for (const rec of Object.values(db().orders)) {
    if (rec.order.status === 'pending' && Date.parse(rec.resolveAt) <= now) {
      settle(rec)
      changed = true
    }
  }
  if (changed) persist()
}

export function scheduleSettlement(rec: OrderRecord) {
  const ms = Math.max(0, Date.parse(rec.resolveAt) - Date.now())
  setTimeout(settleDueOrders, ms + 5)
}

/** No boot do mock: reagenda pedidos que ficaram pendentes antes de um refresh. */
export function resumePendingSettlements() {
  for (const rec of Object.values(db().orders)) {
    if (rec.order.status === 'pending') scheduleSettlement(rec)
  }
}
