import { expect, test } from '@playwright/test'

test.describe('smoke @smoke', () => {
  test('home renderiza com o worker MSW ativo', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Explorar NFTs' })).toBeVisible()

    // O worker só é registrado se VITE_ENABLE_MOCKS != 'false' e intercepta /api.
    const health = await page.evaluate(async () => {
      const res = await fetch('/api/health')
      return res.json()
    })
    expect(health).toEqual({ status: 'ok', mock: true })
  })

  test('acesso direto a rota dinâmica funciona', async ({ page }) => {
    await page.goto('/nft/abc-123')
    await expect(page.getByRole('heading', { level: 1, name: 'Detalhe do NFT' })).toBeVisible()
    await expect(page.getByTestId('nft-id')).toHaveText('ID: abc-123')
  })

  test('rota inexistente mostra 404', async ({ page }) => {
    await page.goto('/rota-que-nao-existe')
    await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar para o início' }).click()
    await expect(page).toHaveURL('/')
  })
})
