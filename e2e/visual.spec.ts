import { expect, test, type Locator, type Page } from '@playwright/test'
import { ANA, loginAs } from './support/auth'
import { bootMock } from './support/mock'

/**
 * Regressão visual (início, detalhe, carrinho, pagamento) em desktop 1440 e mobile 390 (projetos do config).
 *
 * Baselines são geradas em Linux, na imagem oficial `mcr.microsoft.com/playwright` da mesma versão do
 * `@playwright/test` (`pnpm test:visual:update` via Docker ou o workflow `e2e.yml` com `update_snapshots`).
 * Renderização de fonte muda entre sistemas, então fora do Linux a comparação é pulada (a não ser com
 * `VISUAL_LOCAL=1`, para inspecionar diferenças).
 *
 * Estabilidade: banco mock resetado + cenário `default` (seed determinística), movimento reduzido e
 * `animations: 'disabled'`, fontes e imagens carregadas antes da captura, caret escondido, e máscara no
 * que muda entre execuções (região aria-live, toasts e indicador de tempo real).
 */
test.skip(
  process.platform !== 'linux' && !process.env.VISUAL_LOCAL,
  'Baselines são Linux (Docker/CI). Rode `pnpm test:visual:update` ou use VISUAL_LOCAL=1.',
)

test.use({ reducedMotion: 'reduce' })

/** Espera fontes, imagens visíveis decodificadas e a rede do app ficar ociosa. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    await document.fonts.ready
    const imgs = Array.from(document.images).filter((img) => img.loading !== 'lazy' || img.getBoundingClientRect().top < innerHeight)
    await Promise.all(imgs.map((img) => (img.complete ? img.decode().catch(() => undefined) : new Promise((r) => {
      img.addEventListener('load', r, { once: true })
      img.addEventListener('error', r, { once: true })
    }))))
  })
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
}

/** Conteúdo que varia entre execuções sem ser regressão. */
const dynamic = (page: Page): Locator[] => [
  page.locator('[data-sonner-toaster]'),
  page.getByTestId('realtime-offline'),
]

async function snap(page: Page, name: string) {
  await settle(page)
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    mask: dynamic(page),
    maxDiffPixelRatio: 0.01,
  })
}

async function addToCart(page: Page, nftId: string) {
  await page.goto(`/nft/${nftId}`)
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.locator('#live-region')).toContainText('no carrinho')
}

test.describe('regressão visual @visual', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page, 'default')
  })

  test('início', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
    await snap(page, 'inicio')
  })

  test('detalhe', async ({ page }) => {
    await page.goto('/nft/nft-001')
    await expect(page.getByRole('heading', { level: 1, name: /#001$/ })).toBeVisible()
    await snap(page, 'detalhe')
  })

  test('carrinho', async ({ page }) => {
    await addToCart(page, 'nft-002')
    await page.goto('/cart')
    await expect(page.getByTestId('quote-subtotal')).toBeVisible()
    await snap(page, 'carrinho')
  })

  test('pagamento', async ({ page }) => {
    await loginAs(page, ANA, '/nft/nft-002')
    await addToCart(page, 'nft-002')
    await page.goto('/checkout')
    await expect(page.getByRole('heading', { name: 'Pagamento', level: 1 })).toBeVisible()
    await expect(page.getByLabel('Nome completo')).toHaveValue(ANA.name)
    await snap(page, 'pagamento')
  })
})
