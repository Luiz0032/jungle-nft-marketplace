import { expect, test } from '@playwright/test'
import {
  ApiErrorSchema,
  CartSchema,
  NftDetailSchema,
  NftPageSchema,
  OrderSchema,
  QuoteSchema,
  SessionSchema,
  WalletListSchema,
} from '../src/contracts'
import { api, bootMock, login, setScenario } from './support/mock'

// Testa o "backend" mock (handlers MSW) direto pela rede da página. As respostas são validadas
// com os MESMOS schemas zod que a app usa, garantindo que mock e contrato não divergem.

const errorCode = (body: unknown) => ApiErrorSchema.parse(body).code

test.describe('API mock @api', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page)
  })

  test('catálogo: seed, filtros, ordenação, paginação e 404', async ({ page }) => {
    const all = NftPageSchema.parse((await api(page, 'GET', '/nfts?pageSize=48')).body)
    expect(all.total).toBeGreaterThanOrEqual(40)

    const p2 = NftPageSchema.parse((await api(page, 'GET', '/nfts?page=2&pageSize=10')).body)
    expect(p2).toMatchObject({ page: 2, pageSize: 10, totalPages: Math.ceil(all.total / 10) })
    expect(p2.items).toHaveLength(10)

    const filtered = NftPageSchema.parse(
      (await api(page, 'GET', '/nfts?collection=selva-neon&collection=ecos-do-rio&sort=price_asc&pageSize=48')).body,
    )
    expect(filtered.items.length).toBeGreaterThan(0)
    expect(filtered.items.every((n) => ['selva-neon', 'ecos-do-rio'].includes(n.collection.slug))).toBe(true)
    const prices = filtered.items.map((n) => Number(n.price)) // só para comparar ordem no teste
    expect(prices).toEqual([...prices].sort((a, b) => a - b))

    const ranged = NftPageSchema.parse((await api(page, 'GET', '/nfts?minPrice=0.5&maxPrice=1&pageSize=48')).body)
    expect(ranged.items.every((n) => Number(n.price) >= 0.5 && Number(n.price) <= 1)).toBe(true)

    const search = NftPageSchema.parse((await api(page, 'GET', '/nfts?q=on%C3%A7a&pageSize=48')).body)
    expect(search.items.length).toBeGreaterThan(0)
    expect(search.items.every((n) => n.title.toLowerCase().includes('onça'))).toBe(true)

    // Determinismo do seed.
    const detail = NftDetailSchema.parse((await api(page, 'GET', '/nfts/nft-001')).body)
    expect(detail.editions[0]!.id).toBe('nft-001-std')

    expect((await api(page, 'GET', '/nfts?pageSize=999')).status).toBe(422)
    const missing = await api(page, 'GET', '/nfts/nao-existe')
    expect(missing.status).toBe(404)
    expect(errorCode(missing.body)).toBe('NOT_FOUND')
  })

  test('auth: cadastro, conflito, validação, login, sessão, logout e senha com hash', async ({ page }) => {
    const created = await api(page, 'POST', '/auth/register', {
      body: { name: 'Carla Teste', email: 'carla@jungle.test', password: 'Segura123' },
    })
    expect(created.status).toBe(201)
    const session = SessionSchema.parse(created.body)

    const dup = await api(page, 'POST', '/auth/register', {
      body: { name: 'Outra', email: 'CARLA@jungle.test', password: 'Segura123' },
    })
    expect(dup.status).toBe(409)
    expect(ApiErrorSchema.parse(dup.body).fields?.email).toBeTruthy()

    const invalid = await api(page, 'POST', '/auth/register', { body: { name: 'X', email: 'ruim', password: '123' } })
    expect(invalid.status).toBe(422)
    expect(Object.keys(ApiErrorSchema.parse(invalid.body).fields ?? {})).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    )

    const wrong = await api(page, 'POST', '/auth/login', { body: { email: 'ana@jungle.test', password: 'errada1' } })
    expect(wrong.status).toBe(401)

    const me = await api(page, 'GET', '/auth/session', { token: session.token })
    expect(SessionSchema.parse(me.body).user.email).toBe('carla@jungle.test')
    expect(errorCode((await api(page, 'GET', '/auth/session')).body)).toBe('UNAUTHENTICATED')

    expect((await api(page, 'POST', '/auth/logout', { token: session.token })).status).toBe(204)
    expect(errorCode((await api(page, 'GET', '/auth/session', { token: session.token })).body)).toBe('SESSION_EXPIRED')

    const stored = await page.evaluate(() => localStorage.getItem('jungle-mock-db:v1') ?? '')
    expect(stored).not.toContain('Senha@123')
    expect(stored).not.toContain('Segura123')
  })

  test('carrinho e cotação: estoque, merge e cupons', async ({ page }) => {
    const token = await login(page)
    const nft = NftDetailSchema.parse((await api(page, 'GET', '/nfts/nft-001')).body)
    const edition = nft.editions[0]!

    const added = CartSchema.parse(
      (await api(page, 'POST', '/cart/items', { token, body: { nftId: nft.id, editionId: edition.id, quantity: 1 } })).body,
    )
    expect(added.items).toHaveLength(1)

    const tooMany = await api(page, 'PATCH', `/cart/items/${added.items[0]!.id}`, {
      token,
      body: { quantity: edition.available + 1 },
    })
    expect(tooMany.status).toBe(409)
    expect(errorCode(tooMany.body)).toBe('AVAILABILITY_CONFLICT')

    const merged = CartSchema.parse(
      (
        await api(page, 'POST', '/cart/merge', {
          token,
          body: { items: [{ nftId: nft.id, editionId: edition.id, quantity: 999 }] },
        })
      ).body,
    )
    expect(merged.items[0]!.quantity).toBe(edition.available) // soma limitada ao estoque

    const items = [{ editionId: edition.id, quantity: 1 }]
    const plain = QuoteSchema.parse((await api(page, 'POST', '/quote', { body: { items } })).body)
    expect(plain.discount).toBe('0')
    const withCoupon = QuoteSchema.parse((await api(page, 'POST', '/quote', { body: { items, coupon: 'jungle10' } })).body)
    expect(withCoupon.coupon).toEqual({ code: 'JUNGLE10', status: 'applied' })
    expect(withCoupon.discount).not.toBe('0')

    expect(errorCode((await api(page, 'POST', '/quote', { body: { items, coupon: 'EXPIRED5' } })).body)).toBe('COUPON_EXPIRED')
    expect(errorCode((await api(page, 'POST', '/quote', { body: { items, coupon: 'NADA' } })).body)).toBe('COUPON_INVALID')
  })

  test('pedido: idempotência, confirmação assíncrona, recuperação por key e isolamento', async ({ page }) => {
    const token = await login(page)
    const wallets = WalletListSchema.parse((await api(page, 'GET', '/wallets', { token })).body)
    const wallet = wallets.find((w) => w.primary)!
    const quote = QuoteSchema.parse(
      (await api(page, 'POST', '/quote', { token, body: { items: [{ editionId: 'nft-002-std', quantity: 1 }] } })).body,
    )
    const body = {
      quoteId: quote.id,
      quoteVersion: quote.version,
      walletId: wallet.id,
      network: wallet.network,
      collector: { name: 'Ana Souza', email: 'ana@jungle.test' },
    }
    const headers = { 'Idempotency-Key': 'e2e-key-1' }

    expect((await api(page, 'POST', '/orders', { token, body })).status).toBe(422) // sem key

    const first = await api(page, 'POST', '/orders', { token, body, headers })
    expect(first.status).toBe(202)
    const order = OrderSchema.parse(first.body)
    expect(order.status).toBe('pending')
    expect(order.receipt).toBeNull()

    const replay = OrderSchema.parse((await api(page, 'POST', '/orders', { token, body, headers })).body)
    expect(replay.id).toBe(order.id)

    const conflict = await api(page, 'POST', '/orders', {
      token,
      headers,
      body: { ...body, collector: { name: 'Outro Nome', email: 'ana@jungle.test' } },
    })
    expect(conflict.status).toBe(409)
    expect(errorCode(conflict.body)).toBe('CONFLICT')

    const stale = await api(page, 'POST', '/orders', {
      token,
      headers: { 'Idempotency-Key': 'e2e-key-2' },
      body: { ...body, quoteVersion: quote.version + 1 },
    })
    expect(errorCode(stale.body)).toBe('QUOTE_OUTDATED')

    await expect
      .poll(async () => OrderSchema.parse((await api(page, 'GET', `/orders/${order.id}`, { token })).body).status, {
        timeout: 10_000,
      })
      .toBe('confirmed')
    const confirmed = OrderSchema.parse((await api(page, 'GET', '/orders/by-key/e2e-key-1', { token })).body)
    expect(confirmed.id).toBe(order.id)
    expect(confirmed.transactionId).toMatch(/^0x[0-9a-f]{64}$/)
    expect(confirmed.receipt?.total).toBe(quote.total)

    const bruno = await login(page, 'bruno@jungle.test')
    expect(errorCode((await api(page, 'GET', `/orders/${order.id}`, { token: bruno })).body)).toBe('FORBIDDEN')
    expect((await api(page, 'GET', '/orders/by-key/e2e-key-1', { token: bruno })).status).toBe(404)
  })

  test('cenários: payment-declined, empty, session-expired, offline', async ({ page }) => {
    const token = await login(page)
    const wallet = WalletListSchema.parse((await api(page, 'GET', '/wallets', { token })).body)[0]!
    const quote = QuoteSchema.parse(
      (await api(page, 'POST', '/quote', { token, body: { items: [{ editionId: 'nft-003-std', quantity: 1 }] } })).body,
    )
    await setScenario(page, 'payment-declined')
    const created = await api(page, 'POST', '/orders', {
      token,
      headers: { 'Idempotency-Key': 'declined-1' },
      body: {
        quoteId: quote.id,
        quoteVersion: quote.version,
        walletId: wallet.id,
        network: wallet.network,
        collector: { name: 'Ana Souza', email: 'ana@jungle.test' },
      },
    })
    const id = OrderSchema.parse(created.body).id
    await expect
      .poll(async () => OrderSchema.parse((await api(page, 'GET', `/orders/${id}`, { token })).body).status, {
        timeout: 10_000,
      })
      .toBe('rejected')

    await setScenario(page, 'empty')
    expect(NftPageSchema.parse((await api(page, 'GET', '/nfts')).body).total).toBe(0)

    await setScenario(page, 'session-expired')
    expect(errorCode((await api(page, 'GET', '/cart', { token })).body)).toBe('SESSION_EXPIRED')
    const fresh = await login(page)
    expect((await api(page, 'GET', '/cart', { token: fresh })).status).toBe(200) // expira só uma vez

    await setScenario(page, 'offline')
    expect((await api(page, 'GET', '/nfts')).networkError).toBe(true)
  })

  test('cenários: flaky é reproduzível e ?scenario seleciona pela URL', async ({ page }) => {
    // Página sem chamadas de fundo (a Home busca catálogo/facetas e faz retry): o contador do PRNG fica só nosso.
    await page.goto('/login')
    await page.waitForFunction(() => window.__mock !== undefined)
    const run = async () => {
      await page.evaluate(() => window.__mock!.setScenario('flaky'))
      const statuses: number[] = []
      for (let i = 0; i < 12; i++) statuses.push((await api(page, 'GET', '/catalog/facets')).status)
      return statuses
    }
    const a = await run()
    const b = await run()
    expect(a).toEqual(b)
    expect(a).toContain(503)
    expect(a).toContain(200)

    await page.goto('/?scenario=empty')
    await page.waitForFunction(() => window.__mock !== undefined)
    expect(await page.evaluate(() => window.__mock!.getScenario())).toBe('empty')
    await page.goto('/?reset=1')
    await page.waitForFunction(() => window.__mock !== undefined)
    expect(await page.evaluate(() => window.__mock!.getScenario())).toBe('default')
  })
})
