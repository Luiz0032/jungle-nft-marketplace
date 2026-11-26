import { expect, test, type Page } from '@playwright/test'
import { ANA, loginAs } from './support/auth'
import { bootMock, setScenario } from './support/mock'

const NFT = 'nft-002'
const EDITION = `${NFT}-std`
const live = (page: Page) => page.locator('#live-region')
const confirmButton = (page: Page) => page.getByRole('button', { name: /^(Confirmar pagamento|Processando…|Reenviar pedido)$/ })
const orders = (page: Page) => page.evaluate(() => window.__mock!.orders())

async function addToCart(page: Page, nftId = NFT) {
  await page.goto(`/nft/${nftId}`)
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(live(page)).toContainText('no carrinho')
}

async function openCheckout(page: Page) {
  await page.goto('/cart')
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page.getByRole('heading', { name: 'Pagamento', level: 1 })).toBeVisible()
}

/** Pede a conexão e responde no popup da extensão simulada. */
async function answerWallet(page: Page, answer: 'Conectar' | 'Rejeitar') {
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  const prompt = page.getByRole('dialog', { name: /KurioWallet/ })
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: answer, exact: true }).click()
}

async function toReview(page: Page) {
  await answerWallet(page, 'Conectar')
  await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByRole('heading', { name: 'Revise antes de pagar' })).toBeVisible()
}

/** Logado como Ana, com nft-002 no carrinho, na revisão. */
async function readyToPay(page: Page) {
  await loginAs(page, ANA, `/nft/${NFT}`)
  await addToCart(page)
  await openCheckout(page)
  await toReview(page)
  await expect(confirmButton(page)).toBeEnabled()
}

const status = (page: Page) => page.getByTestId('order')

test.describe('checkout @checkout', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page)
  })

  test('compra completa: catálogo → carrinho → pagamento → recibo (snapshot)', async ({ page }) => {
    await loginAs(page, ANA, '/')
    await page.getByTestId('nft-card').first().getByRole('link').first().click()
    await expect(page).toHaveURL(/\/nft\//)
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(live(page)).toContainText('no carrinho')
    await openCheckout(page)

    // Dados do colecionador vêm do perfil; validação no cliente.
    const name = page.getByLabel('Nome completo')
    await expect(name).toHaveValue(ANA.name)
    await name.fill('')
    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await name.fill(ANA.name)

    await toReview(page)
    const total = await page.getByTestId('checkout-total').innerText()
    await confirmButton(page).click()

    await expect(page).toHaveURL(/\/orders\/ord-/)
    await expect(page.getByRole('heading', { name: 'Processando pagamento…' })).toBeVisible()
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible()
    await expect(page.getByTestId('receipt-total')).toHaveText(total)
    await expect(page.getByTestId('tx-id')).toHaveText(/^0x[0-9a-f]{64}$/)
    await expect(live(page)).toContainText('Pagamento confirmado')

    // Itens comprados saíram do carrinho.
    await expect(page.getByTestId('cart-badge')).toHaveCount(0)

    // Recibo é snapshot: mudar o preço depois não altera o pedido.
    const unit = await page.getByTestId('receipt-subtotal').innerText()
    const editionId = (await page.locator('[data-testid^="receipt-line-"]').first().getAttribute('data-testid'))!.replace('receipt-line-', '')
    await page.evaluate((id) => window.__mock!.updateEdition(id, { price: '42' }), editionId)
    await page.reload()
    await expect(page.getByTestId('receipt-subtotal')).toHaveText(unit)
    expect(await orders(page)).toHaveLength(1)
  })

  test('carteira: rejeitar, conectar e desconectar na extensão', async ({ page }) => {
    await loginAs(page, ANA, `/nft/${NFT}`)
    await addToCart(page)
    await openCheckout(page)

    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await expect(page.getByText('Conecte a carteira selecionada para continuar.')).toBeVisible()

    await answerWallet(page, 'Rejeitar')
    await expect(page.getByRole('alert').filter({ hasText: 'Conexão recusada na carteira.' })).toBeVisible()
    await expect(page.getByTestId('wallet-status')).toContainText('Não conectada')

    await answerWallet(page, 'Conectar')
    await expect(page.getByTestId('wallet-status')).toContainText('Conectada: MetaMask principal')

    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByTestId('wallet-status')).toContainText('Não conectada')

    // Outra rede → outra carteira.
    await page.getByText('Polygon', { exact: true }).click()
    await expect(page.getByRole('radio', { name: /Carteira Polygon/ })).toBeChecked()
  })

  test('pagamento recusado devolve ao fluxo sem perder o carrinho', async ({ page }) => {
    await readyToPay(page)
    await setScenario(page, 'payment-declined')
    await confirmButton(page).click()
    await expect(status(page)).toHaveAttribute('data-status', 'rejected', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(page.getByText('Pedido confirmado')).toHaveCount(0)
    await expect(page.getByTestId('cart-badge')).toHaveText('1')

    await setScenario(page, 'default')
    await page.getByRole('link', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { name: 'Pagamento', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: 'Revisar pedido' }).click() // carteira continua conectada
    await confirmButton(page).click()
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    const all = await orders(page)
    expect(all.map((o) => o.status).sort()).toEqual(['confirmed', 'rejected'])
    expect(new Set(all.map((o) => o.idempotencyKey)).size).toBe(2) // nova tentativa = nova chave
  })

  test('cliques repetidos criam um único pedido', async ({ page }) => {
    await readyToPay(page)
    await setScenario(page, 'slow')
    await confirmButton(page).evaluate((el: HTMLButtonElement) => {
      el.click()
      el.click()
      el.click()
    })
    await expect(confirmButton(page)).toBeDisabled()
    await expect(page).toHaveURL(/\/orders\/ord-/, { timeout: 15_000 })
    expect(await orders(page)).toHaveLength(1)
  })

  test('timeout na criação recupera o MESMO pedido pela chave', async ({ page }) => {
    test.setTimeout(60_000)
    await readyToPay(page)
    await setScenario(page, 'order-timeout')
    const started = Date.now()
    await confirmButton(page).click()
    await expect(page.getByTestId('checkout-phase')).toContainText('Enviando o pedido')
    await expect(page).toHaveURL(/\/orders\/ord-/, { timeout: 20_000 })
    // Chegou ao pedido pelo caminho do timeout do Axios (10 s) + GET /orders/by-key, não pela resposta (15 s).
    const elapsed = Date.now() - started
    expect(elapsed).toBeGreaterThan(9_500)
    expect(elapsed).toBeLessThan(15_000)
    const created = await orders(page)
    expect(created).toHaveLength(1)
    expect(page.url()).toContain(created[0]!.id)
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
  })

  test('mudança de preço via socket na revisão exige reconfirmação @realtime', async ({ page }) => {
    await readyToPay(page)
    const before = await page.getByTestId('checkout-total').innerText()
    await page.evaluate((id) => window.__mock!.updateEdition(id, { price: '9.5' }), EDITION)

    await expect(live(page)).toContainText('preço agora 9,5 ETH')
    const banner = page.getByTestId('quote-changed')
    await expect(banner).toContainText('Os valores mudaram')
    await expect(banner).toContainText('9,5 ETH')
    await expect(confirmButton(page)).toBeDisabled()
    await expect(page.getByTestId('checkout-total')).not.toHaveText(before)

    await banner.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await confirmButton(page).click()
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    await expect(page.getByTestId(`receipt-line-${EDITION}`).getByTestId('unit-price')).toHaveText('9,5 ETH')
  })

  test('estoque esgotado via socket bloqueia o pagamento @realtime', async ({ page }) => {
    await readyToPay(page)
    await page.evaluate((id) => window.__mock!.updateEdition(id, { available: 0 }), EDITION)
    await expect(live(page)).toContainText('esgotada')
    await expect(page.getByRole('alert').filter({ hasText: 'Ajuste o carrinho' })).toBeVisible()
    await expect(confirmButton(page)).toBeDisabled()
    expect(await orders(page)).toHaveLength(0)
  })

  test('sem evento (socket fora), a revalidação antes de enviar pega a mudança', async ({ page }) => {
    await readyToPay(page)
    await page.evaluate(() => window.__mock!.dropSockets({ outageMs: 60_000 }))
    await page.evaluate((id) => window.__mock!.updateEdition(id, { price: '7' }), EDITION)
    await confirmButton(page).click()
    await expect(live(page)).toContainText('Os valores mudaram desde a revisão')
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    expect(await orders(page)).toHaveLength(0)
  })

  test('queda do socket com pedido pendente: reconcilia e confirma; refresh retoma @realtime', async ({ page }) => {
    await readyToPay(page)
    await setScenario(page, 'socket-drop')
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/orders\/ord-/)
    await expect(page.getByTestId('realtime-offline')).toBeVisible({ timeout: 5_000 })
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 15_000 })

    // Refresh num pedido já confirmado mostra o mesmo recibo.
    await page.reload()
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed')
    expect(await orders(page)).toHaveLength(1)
  })

  test('refresh no meio do envio retoma pelo pedido da chave salva', async ({ page }) => {
    await readyToPay(page)
    await setScenario(page, 'order-timeout') // o pedido é criado, a resposta fica presa
    await confirmButton(page).click()
    await expect(page.getByTestId('checkout-phase')).toContainText('Enviando o pedido')
    await expect.poll(() => orders(page).then((o) => o.length)).toBe(1)
    await page.reload()

    // A tentativa persistida (mesma Idempotency-Key) encontra o pedido; nenhum pedido novo.
    await expect(page).toHaveURL(/\/orders\/ord-/, { timeout: 15_000 })
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    expect(await orders(page)).toHaveLength(1)

    // Pedido terminal: a tentativa acabou; o checkout não volta para ele e o carrinho está vazio.
    await page.goto('/checkout')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible({ timeout: 15_000 })
  })

  test('order-hold: pedido pendente sobrevive ao refresh e confirma por evento do servidor @realtime', async ({ page }) => {
    await readyToPay(page)
    await setScenario(page, 'order-hold')
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/orders\/ord-/)
    const orderId = new URL(page.url()).pathname.split('/').pop()!
    await expect(status(page)).toHaveAttribute('data-status', 'pending')

    await page.reload()
    await expect(status(page)).toHaveAttribute('data-status', 'pending')
    await expect(page.getByRole('heading', { name: 'Processando pagamento…' })).toBeVisible()
    // Socket do usuário reconectado após o refresh antes de o servidor emitir.
    await expect.poll(() => page.evaluate(() => window.__mock!.socket().connections.some((c) => c.userId !== null))).toBe(true)

    await page.evaluate((id) => window.__mock!.settleOrder(id, 'confirmed'), orderId)
    await expect(status(page)).toHaveAttribute('data-status', 'confirmed')
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible()
    await expect(live(page)).toContainText('Pagamento confirmado')

    // Chegou pelo socket (order.updated emitido pelo servidor), e nenhum pedido novo foi criado.
    const emitted = await page.evaluate(() => window.__mock!.socket().emitted)
    expect(
      emitted.some((e) => e.type === 'order.updated' && e.payload.orderId === orderId && e.payload.status === 'confirmed'),
    ).toBe(true)
    const all = await orders(page)
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ id: orderId, status: 'confirmed' })
  })
})
