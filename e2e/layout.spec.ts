import { expect, test } from '@playwright/test'
import { isMobile } from './support/auth'
import { bootMock } from './support/mock'

test.describe('layout base @visual @a11y', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page, 'default')
  })

  test('fonte Roboto Mono self-hosted carrega e o tema do Figma é aplicado', async ({ page }) => {
    const fontRequests: string[] = []
    page.on('request', (req) => {
      if (req.resourceType() === 'font') fontRequests.push(req.url())
    })
    await page.goto('/')
    const style = await page.evaluate(async () => {
      const faces = await document.fonts.load('16px "Roboto Mono"')
      return {
        loaded: faces.length > 0 && faces.every((f) => f.status === 'loaded'),
        bg: getComputedStyle(document.body).backgroundColor,
      }
    })
    expect(style.loaded).toBe(true)
    expect(style.bg).toBe('rgb(20, 13, 10)') // color/ink
    // Nada de Google Fonts em runtime: a fonte vem do próprio domínio.
    expect(fontRequests.every((url) => new URL(url).pathname.startsWith('/fonts/'))).toBe(true)
  })

  test('header e footer seguem o Figma e só linkam rotas reais', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Principal' })
    const isMobile = (page.viewportSize()?.width ?? 0) < 1024

    if (!isMobile) {
      await expect(nav.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
      await expect(nav.getByText('Criadores')).toHaveAttribute('aria-disabled', 'true')
    }
    await expect(page.getByRole('link', { name: 'Carrinho' })).toHaveAttribute('href', '/cart')

    const footer = page.getByRole('contentinfo')
    await expect(footer.getByText('© 2026 Kurio. Propriedade digital para todos.')).toBeVisible()
    // Newsletter fora de escopo: desabilitada, não finge sucesso.
    await expect(footer.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    await expect(footer.getByLabel('E-mail para a newsletter')).toBeDisabled()

    await page.getByRole('link', { name: 'Entrar' }).click()
    await expect(page).toHaveURL('/login')
  })

  test('fluxo de compra marca a seção atual no header', async ({ page }) => {
    await page.goto('/cart')
    const nav = page.getByRole('navigation', { name: 'Principal' })
    if (isMobile(page)) {
      // < 1024 a nav some (Figma mobile não tem nav no topo); o atalho do carrinho marca a página atual.
      await expect(nav).toBeHidden()
      await expect(page.getByRole('link', { name: /^Carrinho/ })).toHaveAttribute('aria-current', 'page')
    } else {
      await expect(nav.getByRole('link', { name: 'Mercado' })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('sem rolagem horizontal', async ({ page }) => {
    await page.goto('/')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
