import { expect, test, type Page } from '@playwright/test'
import { ANA, BRUNO, loginAs, submitLogin } from './support/auth'
import { bootMock, setScenario } from './support/mock'

// Seed: Ana já favoritou nft-001 e nft-005; ninguém tem o nft-002.
const NFT = 'nft-002'
const heart = (page: Page) => page.getByRole('button', { name: /^(Favoritar|Remover) / }).first()

async function openNft(page: Page) {
  await page.goto(`/nft/${NFT}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

test.describe('favoritos @favorites', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page)
  })

  test('convidado é levado ao login e volta para favoritar', async ({ page }) => {
    await openNft(page)
    await heart(page).click()
    await expect(page).toHaveURL(new RegExp(`/login\\?redirect=%2Fnft%2F${NFT}$`))
    await submitLogin(page, ANA)
    await expect(page).toHaveURL(`/nft/${NFT}`)
    await heart(page).click()
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('otimista, persiste no servidor e desfavorita', async ({ page }) => {
    await loginAs(page, ANA, `/nft/${NFT}`)
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')

    await setScenario(page, 'slow') // servidor lento: a UI muda antes da resposta
    await heart(page).click()
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true', { timeout: 500 })
    await expect(page.locator('#live-region')).toContainText('adicionado aos favoritos', { timeout: 10_000 })

    await setScenario(page, 'default')
    await page.reload()
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true')

    await heart(page).click()
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('#live-region')).toContainText('removido dos favoritos') // servidor confirmou
    await page.reload()
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')
  })

  test('falha desfaz a mudança (rollback) e a nova tentativa funciona', async ({ page }) => {
    await loginAs(page, ANA, `/nft/${NFT}`)
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')

    await setScenario(page, 'offline')
    await heart(page).click()
    await expect(page.locator('#live-region')).toContainText('Não foi possível favoritar', { timeout: 10_000 })
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')

    await setScenario(page, 'default')
    await heart(page).click()
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#live-region')).toContainText('adicionado aos favoritos') // servidor confirmou
    await page.reload()
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('favoritos são por usuário', async ({ page }) => {
    await loginAs(page, ANA, `/nft/${NFT}`)
    await heart(page).click()
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#live-region')).toContainText('adicionado aos favoritos')

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible()
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')

    await loginAs(page, BRUNO, `/nft/${NFT}`)
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')
    // Favorito do seed da Ana também não aparece para o Bruno (e aparece para ela).
    await page.goto('/nft/nft-001')
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')
    await page.getByRole('button', { name: 'Sair' }).click()
    await loginAs(page, ANA, '/nft/nft-001')
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true')
  })
})
