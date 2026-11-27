import { expect, test, type Page } from '@playwright/test'
import { isMobile } from './support/auth'
import { bootMock, setScenario } from './support/mock'

/** Lê a busca da URL no formato do TanStack Router (arrays/números em JSON, strings cruas). */
function urlSearch(page: Page) {
  const sp = new URL(page.url()).searchParams
  const json = (k: string) => (sp.has(k) ? (JSON.parse(sp.get(k)!) as unknown) : undefined)
  return { q: sp.get('q') ?? undefined, category: json('category'), sort: sp.get('sort') ?? undefined, page: json('page') }
}

const grid = (page: Page) => page.getByTestId('nft-grid')
const cards = (page: Page) => page.getByTestId('nft-card')
const searchbox = (page: Page) => page.getByRole('searchbox', { name: 'Buscar NFTs' })

/** No mobile os filtros ficam no sheet; no desktop, na sidebar. */
async function withFilters(page: Page, action: () => Promise<void>) {
  if (!isMobile(page)) return action()
  await page.getByRole('button', { name: /^Filtros/ }).click()
  await action()
  await page.getByRole('button', { name: 'Fechar filtros' }).click()
}

async function prices(page: Page): Promise<number[]> {
  // Só para conferir a ordenação no teste (a app nunca usa number para ETH).
  const texts = await cards(page).locator('p').allInnerTexts()
  return texts.map((t) => Number.parseFloat(t.replace(/[^\d,]/g, '').replace(',', '.')))
}

test.describe('catálogo @catalog', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page, 'default')
  })

  test('busca + filtros + ordem + página ficam na URL e o histórico volta cada passo', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(9)

    // página 2
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect.poll(() => urlSearch(page).page).toBe(2)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // filtro → volta para a página 1
    await withFilters(page, () => page.getByRole('checkbox', { name: /^Arte/ }).check())
    await expect.poll(() => urlSearch(page)).toEqual({ q: undefined, category: ['arte'], sort: undefined, page: undefined })

    // busca (debounce) combinada com o filtro
    await searchbox(page).fill('Gorila')
    await expect.poll(() => urlSearch(page).q).toBe('Gorila')
    await expect(grid(page)).toHaveAttribute('aria-busy', 'false')
    for (const title of await cards(page).locator('h3').allInnerTexts()) expect(title).toContain('Gorila')

    // ordenação
    await page.getByLabel('Ordenar por:').selectOption('price_asc')
    await expect.poll(() => urlSearch(page).sort).toBe('price_asc')
    await expect(grid(page)).toHaveAttribute('aria-busy', 'false')
    const asc = await prices(page)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))

    // histórico: cada passo volta
    await page.goBack()
    await expect.poll(() => urlSearch(page).sort).toBeUndefined()
    await expect(page.getByLabel('Ordenar por:')).toHaveValue('newest')
    await page.goBack()
    await expect.poll(() => urlSearch(page).q).toBeUndefined()
    await expect(searchbox(page)).toHaveValue('')
    await page.goBack()
    await expect.poll(() => urlSearch(page)).toEqual({ q: undefined, category: undefined, sort: undefined, page: 2 })
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    await page.goForward()
    await expect.poll(() => urlSearch(page).category).toEqual(['arte'])
  })

  test('acesso direto com filtros na URL; parâmetros inválidos caem no padrão', async ({ page }) => {
    await page.goto('/?category=%5B%22musica%22%5D&sort=price_desc&page=2')
    await expect(page.getByLabel('Ordenar por:')).toHaveValue('price_desc')
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    await withFilters(page, () => expect(page.getByRole('checkbox', { name: /^Música/ })).toBeChecked())
    const desc = await prices(page)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))

    await page.goto('/?sort=qualquer&page=-3&category=%5B%22naoexiste%22%5D')
    await expect(page.getByLabel('Ordenar por:')).toHaveValue('newest')
    await expect(cards(page)).toHaveCount(9)
  })

  test('respostas fora de ordem não sobrescrevem a busca mais recente', async ({ page }) => {
    await setScenario(page, 'out-of-order')
    await page.goto('/')
    // Cada busca responde MAIS RÁPIDO que a anterior: a primeira chega por último.
    for (const term of ['Macaco', 'Gorila', 'Orangotango']) {
      await searchbox(page).fill(term)
      await expect.poll(() => urlSearch(page).q).toBe(term)
    }
    await expect(grid(page)).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 })
    await page.waitForTimeout(3_000) // deixa as respostas atrasadas chegarem
    const titles = await cards(page).locator('h3').allInnerTexts()
    expect(titles.length).toBeGreaterThan(0)
    for (const t of titles) expect(t).toContain('Orangotango')
  })

  test('estados: skeleton, vazio com limpar filtros, erro com retry', async ({ page }) => {
    await setScenario(page, 'slow')
    await page.goto('/')
    await expect(grid(page)).toHaveAttribute('aria-busy', 'true')
    await expect(cards(page).first()).toBeVisible({ timeout: 10_000 })

    await setScenario(page, 'default')
    await page.goto('/?q=zzzz')
    await expect(page.getByTestId('catalog-empty')).toContainText('Nenhum NFT encontrado.')
    await page.getByTestId('catalog-empty').getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(cards(page)).toHaveCount(9)
    expect(urlSearch(page).q).toBeUndefined()

    await setScenario(page, 'offline')
    await page.goto('/?sort=popular')
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo.' })).toBeVisible({
      timeout: 15_000,
    })
    await setScenario(page, 'default')
    await page
      .getByRole('alert')
      .filter({ hasText: 'Não foi possível carregar o catálogo.' })
      .getByRole('button', { name: 'Tentar de novo' })
      .click()
    await expect(cards(page)).toHaveCount(9)
  })

  test('detalhe: acesso direto, edições, quantidade dentro do estoque e 404', async ({ page }) => {
    await page.goto('/nft/nft-001')
    await expect(page.getByRole('heading', { level: 1, name: /#001$/ })).toBeVisible()
    const edition = page.getByRole('radio', { checked: true })
    await expect(edition).toBeVisible()

    const qty = page.getByLabel('Quantidade', { exact: true })
    const more = page.getByRole('button', { name: 'Aumentar quantidade' })
    await qty.fill('999')
    const stockText = await page.getByTestId(/^edition-available-/).innerText()
    const stock = Number.parseInt(stockText, 10)
    await expect(qty).toHaveValue(String(stock))
    await expect(more).toBeDisabled()

    // Estoque cai pelo socket abaixo da quantidade escolhida → quantidade acompanha.
    const editionId = (await page.getByTestId(/^edition-available-/).getAttribute('data-testid'))!.replace('edition-available-', '')
    await page.waitForFunction(() => (window.__mock?.socket().connections.length ?? 0) > 0)
    await page.evaluate((id) => window.__mock!.updateEdition(id, { available: 2 }), editionId)
    await expect(page.getByTestId(`edition-available-${editionId}`)).toHaveText('2 disponíveis')
    await expect(qty).toHaveValue('2')
    await expect(page.locator('#live-region')).toContainText('estoque agora 2 unidades')

    await page.goto('/nft/nao-existe')
    await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
  })

  test('card leva ao detalhe e "Mais desta coleção" lista outros NFTs', async ({ page }) => {
    await page.goto('/')
    const first = cards(page).first()
    const title = await first.locator('h3').innerText()
    await first.getByRole('link').click()
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    const related = page.getByRole('region', { name: 'Mais desta coleção' })
    await expect(related.getByTestId('nft-card').first()).toBeVisible()
    await expect(related.getByRole('link', { name: title })).toHaveCount(0)
  })
})
