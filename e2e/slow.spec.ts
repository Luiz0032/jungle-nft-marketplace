import { expect, test, type Page } from '@playwright/test'
import { advanceUntilVisible, pauseClock } from './support/clock'
import { bootMock, setScenario } from './support/mock'

/**
 * Item 12 do desafio: skeletons durante carga lenta, feedback de falha e recuperação após nova tentativa.
 *
 * Relógio controlado: o `delay()` do MSW e o backoff de retry do TanStack Query rodam na página, então com
 * `page.clock` pausado a resposta só chega quando o teste avança o tempo. Assim o skeleton fica na tela de
 * forma determinística (sem depender de a máquina ser rápida ou lenta) e o teste não espera segundos reais.
 * Latência do cenário `slow`: 2–4 s por chamada. `offline`: falha de rede imediata, repetida 2x com backoff.
 */
const grid = (page: Page) => page.getByTestId('nft-grid')
const cards = (page: Page) => page.getByTestId('nft-card')
const live = (page: Page) => page.locator('#live-region')

test.describe('carga lenta e falhas @slow', () => {
  test('catálogo: skeleton com shimmer e dimensões do card até a resposta lenta chegar', async ({ page }) => {
    await bootMock(page, 'slow')
    await pauseClock(page)
    await page.goto('/')

    await expect(grid(page)).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('status').filter({ hasText: 'Carregando NFTs…' })).toBeAttached()
    const skeleton = grid(page).locator('> div').first()
    await expect(skeleton.locator('.shimmer').first()).toBeVisible()
    const skeletonBox = (await skeleton.boundingBox())!
    // Sem avançar o relógio a resposta nunca chega: o skeleton continua.
    await page.waitForTimeout(500)
    await expect(cards(page)).toHaveCount(0)

    await advanceUntilVisible(page, cards(page).first())
    await expect(cards(page)).toHaveCount(9)
    await expect(grid(page)).toHaveAttribute('aria-busy', 'false')
    // O skeleton reserva a mesma largura do card real (sem deslocamento horizontal ao trocar).
    const cardBox = (await cards(page).first().boundingBox())!
    expect(Math.abs(cardBox.width - skeletonBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(cardBox.x - skeletonBox.x)).toBeLessThanOrEqual(1)
  })

  test('detalhe: skeleton enquanto carrega, depois o conteúdo', async ({ page }) => {
    await bootMock(page, 'slow')
    await pauseClock(page)
    await page.goto('/nft/nft-001')

    const loading = page.getByRole('status', { name: 'Carregando NFT' })
    await expect(loading).toBeVisible()
    await expect(loading).toHaveAttribute('aria-busy', 'true')
    await expect(loading.locator('.shimmer').filter({ visible: true }).first()).toBeVisible()

    await advanceUntilVisible(page, page.getByRole('heading', { level: 1 }))
    await expect(loading).toHaveCount(0)
  })

  test('resumo do carrinho: skeleton enquanto a cotação está lenta', async ({ page }) => {
    await bootMock(page, 'default')
    await page.goto('/nft/nft-002')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(live(page)).toContainText('no carrinho')

    await setScenario(page, 'slow')
    await pauseClock(page)
    await page.goto('/cart')
    // Primeiro o carrinho (lento) chega; a cotação ainda não: o resumo mostra o skeleton.
    const calculating = page.getByRole('status', { name: 'Calculando resumo' })
    await advanceUntilVisible(page, calculating)
    await expect(calculating.locator('.shimmer').first()).toBeVisible()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('quote-summary')).toHaveCount(0)

    await advanceUntilVisible(page, page.getByTestId('quote-subtotal'))
    await expect(calculating).toHaveCount(0)
  })

  test('detalhe: falha após os retries mostra erro e "Tentar novamente" recupera', async ({ page }) => {
    await bootMock(page, 'offline')
    await pauseClock(page)
    await page.goto('/nft/nft-001')

    await expect(page.getByRole('status', { name: 'Carregando NFT' })).toBeVisible()
    // Falhas transitórias são repetidas 2x com backoff; só depois o erro aparece.
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar este NFT.' })
    await advanceUntilVisible(page, error)

    await setScenario(page, 'default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await advanceUntilVisible(page, page.getByRole('heading', { level: 1 }))
    await expect(error).toHaveCount(0)
  })

  test('catálogo: falha mostra erro e a nova tentativa carrega a lista', async ({ page }) => {
    await bootMock(page, 'offline')
    await pauseClock(page)
    await page.goto('/?sort=popular')

    await expect(grid(page)).toHaveAttribute('aria-busy', 'true')
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo.' })
    await advanceUntilVisible(page, error)

    await setScenario(page, 'default')
    await error.getByRole('button', { name: 'Tentar de novo' }).click()
    await advanceUntilVisible(page, cards(page).first())
    await expect(cards(page)).toHaveCount(9)
  })

  test('carrinho: falha ao carregar mostra erro e a nova tentativa traz itens e resumo', async ({ page }) => {
    await bootMock(page, 'default')
    await page.goto('/nft/nft-002')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(live(page)).toContainText('no carrinho')

    await setScenario(page, 'offline')
    await pauseClock(page)
    await page.goto('/cart')
    // O carrinho de convidado também consulta o servidor (estoque/preço atuais): sem rede, erro com retry.
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar seu carrinho.' })
    await advanceUntilVisible(page, error)

    await setScenario(page, 'default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    // O item guardado localmente não se perdeu: volta junto com o resumo.
    await advanceUntilVisible(page, page.getByTestId('cart-line-nft-002-std'))
    await advanceUntilVisible(page, page.getByTestId('quote-subtotal'))
    await expect(error).toHaveCount(0)
  })
})
