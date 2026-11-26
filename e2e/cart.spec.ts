import { expect, test, type Page } from '@playwright/test'
import { ANA, BRUNO, loginAs, submitLogin } from './support/auth'
import { api, bootMock, setScenario } from './support/mock'

const NFT = 'nft-002'
const EDITION = `${NFT}-std` // a edição padrão sempre tem estoque e é a pré-selecionada
const live = (page: Page) => page.locator('#live-region')
const line = (page: Page, editionId = EDITION) => page.getByTestId(`cart-line-${editionId}`)
const qtyInput = (page: Page) => line(page).getByRole('textbox', { name: /^Quantidade de / })

async function stockOf(page: Page, editionId = EDITION) {
  const res = await api(page, 'GET', `/nfts/${NFT}`)
  const nft = res.body as { editions: { id: string; available: number; price: string }[] }
  return nft.editions.find((e) => e.id === editionId)!
}

/** Adiciona pela UI (detalhe do NFT) e espera a confirmação. */
async function addFromDetail(page: Page, nftId = NFT) {
  await page.goto(`/nft/${nftId}`)
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(live(page)).toContainText('no carrinho')
}

async function openCart(page: Page) {
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: /Carrinho de NFTs/ })).toBeVisible()
}

test.describe('carrinho @cart', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page)
  })

  test('vazio mostra estado e link para o mercado', async ({ page }) => {
    await openCart(page)
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explorar o mercado' })).toBeVisible()
  })

  test('convidado: quantidade, resumo da cotação e persistência no refresh', async ({ page }) => {
    await addFromDetail(page)
    await expect(page.getByTestId('cart-badge')).toHaveText('1')
    await openCart(page)
    await expect(line(page)).toBeVisible()
    await expect(qtyInput(page)).toHaveValue('1')

    const subtotal1 = await page.getByTestId('quote-subtotal').textContent()
    await expect(page.getByTestId('quote-subtotal')).toHaveText(await line(page).getByTestId('line-total').innerText())

    await line(page).getByRole('button', { name: /^Aumentar quantidade/ }).click()
    await expect(qtyInput(page)).toHaveValue('2')
    // Nova cotação para a nova quantidade (subtotal muda e bate com a linha).
    await expect(page.getByTestId('quote-subtotal')).not.toHaveText(subtotal1!)
    await expect(page.getByTestId('quote-subtotal')).toHaveText(await line(page).getByTestId('line-total').innerText())
    await expect(page.getByTestId('quote-fee')).toHaveText('0,0025 ETH')

    await page.reload()
    await expect(qtyInput(page)).toHaveValue('2')
    await expect(page.getByTestId('cart-badge')).toHaveText('2')
  })

  test('limite pela edição: não passa do estoque', async ({ page }) => {
    const { available } = await stockOf(page)
    await addFromDetail(page)
    await openCart(page)
    await qtyInput(page).fill(String(available + 50))
    await qtyInput(page).press('Enter')
    await expect(qtyInput(page)).toHaveValue(String(available))
    await expect(line(page).getByRole('button', { name: /^Aumentar quantidade/ })).toBeDisabled()
    await qtyInput(page).fill('0')
    await qtyInput(page).press('Enter')
    await expect(qtyInput(page)).toHaveValue('1')
    await expect(line(page).getByRole('button', { name: /^Diminuir quantidade/ })).toBeDisabled()
  })

  test('usuário: quantidade otimista com rollback em falha', async ({ page }) => {
    await loginAs(page, ANA, `/nft/${NFT}`)
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(live(page)).toContainText('no carrinho')
    await openCart(page)

    await setScenario(page, 'slow')
    const patched = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/api/cart/items/'), {
      timeout: 10_000,
    })
    await line(page).getByRole('button', { name: /^Aumentar quantidade/ }).click()
    await expect(qtyInput(page)).toHaveValue('2', { timeout: 500 }) // antes da resposta do servidor
    expect((await patched).status()).toBe(200) // servidor confirmou ANTES de trocarmos o cenário
    await expect(page.getByTestId('quote-subtotal')).toHaveText(await line(page).getByTestId('line-total').innerText(), { timeout: 10_000 })

    await setScenario(page, 'offline')
    await line(page).getByRole('button', { name: /^Aumentar quantidade/ }).click()
    await expect(live(page)).toContainText('Não foi possível alterar a quantidade', { timeout: 15_000 })
    await expect(qtyInput(page)).toHaveValue('2')

    await setScenario(page, 'default')
    await page.reload()
    await expect(qtyInput(page)).toHaveValue('2') // persistido no servidor
  })

  test('remoção (convidado e usuário)', async ({ page }) => {
    await addFromDetail(page)
    await addFromDetail(page, 'nft-003')
    await openCart(page)
    await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(2)
    await line(page).getByRole('button', { name: /^Remover / }).click()
    await expect(line(page)).toHaveCount(0)
    await expect(live(page)).toContainText('removido do carrinho')
    await page.reload()
    await expect(line(page)).toHaveCount(0)
    await expect(line(page, 'nft-003-std')).toBeVisible()

    // Logado: remove no servidor.
    await page.getByRole('link', { name: 'Entrar' }).first().click()
    await submitLogin(page, ANA)
    await openCart(page)
    await line(page, 'nft-003-std').getByRole('button', { name: /^Remover / }).click()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })

  test('cupom: inválido, expirado, aplicar e remover', async ({ page }) => {
    await addFromDetail(page)
    await openCart(page)
    const field = page.getByLabel('Código promocional')
    const apply = page.getByRole('button', { name: 'Aplicar' })
    await expect(page.getByTestId('quote-total')).toBeVisible()
    const totalWithout = await page.getByTestId('quote-total').innerText()

    await field.fill('NAOEXISTE')
    await apply.click()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription('Cupom inválido.')
    await expect(page.getByTestId('quote-discount')).toHaveCount(0)

    await field.fill('expired5')
    await apply.click()
    await expect(field).toHaveAccessibleDescription('Este cupom expirou.')
    await expect(page.getByTestId('quote-discount')).toHaveCount(0)

    await field.fill('jungle10')
    await apply.click()
    await expect(page.getByTestId('applied-coupon')).toHaveText('JUNGLE10')
    await expect(page.getByTestId('quote-discount')).toBeVisible()
    await expect(page.getByTestId('quote-total')).not.toHaveText(totalWithout)

    await page.reload() // cupom aceito persiste
    await expect(page.getByTestId('applied-coupon')).toHaveText('JUNGLE10')

    await page.getByRole('button', { name: 'Remover cupom JUNGLE10' }).click()
    await expect(page.getByTestId('quote-discount')).toHaveCount(0)
    await expect(page.getByTestId('quote-total')).toHaveText(totalWithout)
  })

  test('carrinho de convidado é juntado ao da conta no login e é por usuário', async ({ page }) => {
    await addFromDetail(page)
    await openCart(page)
    await page.getByRole('link', { name: 'Entrar para finalizar' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcart/)
    await submitLogin(page, ANA)
    await expect(page).toHaveURL('/cart')
    await expect(qtyInput(page)).toHaveValue('1')
    await expect(live(page)).toContainText('foram para o seu carrinho')
    expect(await page.evaluate(() => localStorage.getItem('jg:guest-cart'))).toBeNull()

    await page.reload() // agora vem do servidor
    await expect(qtyInput(page)).toHaveValue('1')

    // Logout: carrinho da Ana some; Bruno tem o próprio (vazio).
    await page.getByRole('button', { name: 'Sair', exact: true }).click()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    await loginAs(page, BRUNO, '/cart')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    await page.getByRole('button', { name: 'Sair', exact: true }).click()
    await loginAs(page, ANA, '/cart')
    await expect(qtyInput(page)).toHaveValue('1')
  })

  test('nft.updated com o carrinho aberto avisa e recalcula @realtime', async ({ page }) => {
    await addFromDetail(page)
    await openCart(page)
    await expect(page.getByTestId('quote-total')).toBeVisible()
    const totalBefore = await page.getByTestId('quote-total').innerText()

    // Muda o banco do mock: o servidor emite `nft.updated` pelo socket.
    await page.evaluate((id) => window.__mock!.updateEdition(id, { price: '9.5' }), EDITION)
    await expect(live(page)).toContainText('preço agora 9,5 ETH')
    await expect(live(page)).toContainText('Resumo recalculado')
    await expect(line(page).getByTestId('unit-price')).toHaveText('9,5 ETH')
    await expect(page.getByTestId('quote-subtotal')).toHaveText('9,5 ETH')
    await expect(page.getByTestId('quote-total')).not.toHaveText(totalBefore)

    // Estoque zerado: linha avisa e o resumo mostra o conflito.
    await page.evaluate((id) => window.__mock!.updateEdition(id, { available: 0 }), EDITION)
    await expect(live(page)).toContainText('esgotada')
    await expect(line(page).getByTestId('line-warning')).toContainText('Esgotada')
    await expect(page.getByRole('alert').filter({ hasText: 'Ajuste as quantidades' })).toBeVisible()
  })
})
