import { HttpResponse } from 'msw'
import { QuoteInputSchema, type Quote, type QuoteInput } from '@/contracts'
import { add, mul, percentOf, sub } from '@/lib/money'
import { db, nextId } from '@/mocks/db'
import type { QuoteRecord } from '@/mocks/db'
import { findEdition } from './domain'
import { fail, parseBody, requireUser, route } from './utils'

export const QUOTE_TTL_MS = 5 * 60 * 1000

/** Linhas consolidadas por edição + impressão digital de preço/estoque atuais. */
export function priceLines(items: QuoteInput['items']) {
  const merged = new Map<string, number>()
  for (const i of items) merged.set(i.editionId, (merged.get(i.editionId) ?? 0) + i.quantity)

  const missing: string[] = []
  const soldOut: string[] = []
  const lines = [...merged].flatMap(([editionId, quantity]) => {
    const found = findEdition(editionId)
    if (!found) {
      missing.push(editionId)
      return []
    }
    if (quantity > found.edition.available) soldOut.push(editionId)
    return [{ found, line: { editionId, unitPrice: found.edition.price, quantity, lineTotal: mul(found.edition.price, quantity) } }]
  })
  const fingerprint = lines.map(({ found: { edition } }) => `${edition.id}:${edition.version}:${edition.price}`).join('|')
  return { lines, missing, soldOut, fingerprint }
}

export function assertAvailable(soldOut: string[]) {
  if (soldOut.length > 0) {
    fail('AVAILABILITY_CONFLICT', 'Algumas edições não têm estoque suficiente.', { details: { editionIds: soldOut } })
  }
}

function resolveCoupon(code: string | undefined) {
  if (!code) return null
  const normalized = code.trim().toUpperCase()
  const coupon = db().coupons.find((c) => c.code === normalized)
  if (!coupon) fail('COUPON_INVALID', 'Cupom inválido.', { fields: { coupon: 'Cupom inválido.' } })
  if (Date.parse(coupon.expiresAt) <= Date.now()) {
    fail('COUPON_EXPIRED', 'Este cupom expirou.', { fields: { coupon: 'Este cupom expirou.' } })
  }
  return coupon
}

export const quoteHandlers = [
  /** Pública (o carrinho de convidado também precisa de resumo). Com Bearer, a cotação fica vinculada ao usuário. */
  route('post', '/quote', async ({ request }) => {
    const userId = request.headers.has('Authorization') ? requireUser(request).user.id : null
    const input = await parseBody(request, QuoteInputSchema)
    const { lines, missing, soldOut, fingerprint } = priceLines(input.items)
    if (missing.length > 0) {
      fail('VALIDATION_ERROR', 'Edição inexistente na cotação.', { fields: { items: 'Edição inexistente.' }, details: { editionIds: missing } })
    }
    assertAvailable(soldOut)
    const coupon = resolveCoupon(input.coupon)

    const subtotal = add(...lines.map((l) => l.line.lineTotal))
    const discount = coupon ? percentOf(subtotal, coupon.percent) : '0'
    const networkFee = db().networkFee
    const quote: Quote = {
      id: nextId('qt'),
      version: lines.reduce((acc, l) => acc + l.found.edition.version, 0),
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
      lines: lines.map((l) => l.line),
      subtotal,
      discount,
      networkFee,
      total: add(sub(subtotal, discount), networkFee),
      coupon: coupon ? { code: coupon.code, status: 'applied' } : null,
    }

    const quotes = db().quotes
    for (const [id, q] of Object.entries(quotes)) if (Date.parse(q.quote.expiresAt) < Date.now()) delete quotes[id]
    quotes[quote.id] = { quote, userId, couponCode: coupon?.code ?? null, fingerprint } satisfies QuoteRecord
    return HttpResponse.json(quote)
  }),
]
