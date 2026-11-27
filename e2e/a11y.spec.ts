import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ANA, loginAs } from './support/auth'
import { bootMock } from './support/mock'

const NFT = 'nft-002'
const live = (page: Page) => page.locator('#live-region')

/** axe com as regras WCAG 2.1 A/AA; falha listando regra + alvos para facilitar a correção. */
async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Toasts do sonner entram e saem durante a varredura.
    .exclude('[data-sonner-toaster]')
    .analyze()
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
  expect(summary).toEqual([])
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

async function addToCart(page: Page) {
  await page.goto(`/nft/${NFT}`)
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(live(page)).toContainText('no carrinho')
}

test.describe('acessibilidade @a11y', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page, 'default')
  })

  test('telas públicas sem violações axe e sem overflow horizontal', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await expectNoAxeViolations(page)
    await noHorizontalOverflow(page)

    await page.goto(`/nft/${NFT}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoAxeViolations(page)
    await noHorizontalOverflow(page)

    await page.goto('/login')
    await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)

    await page.goto('/register')
    await expect(page.getByLabel('Nome de usuário')).toBeVisible()
    await expectNoAxeViolations(page)

    await page.goto('/rota-que-nao-existe')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('carrinho, checkout, perfil e carteiras sem violações axe', async ({ page }) => {
    await loginAs(page, ANA, `/nft/${NFT}`)
    await addToCart(page)

    await page.goto('/cart')
    await expect(page.getByRole('link', { name: 'Conectar e finalizar' })).toBeVisible()
    await expectNoAxeViolations(page)
    await noHorizontalOverflow(page)

    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await expect(page.getByRole('heading', { name: 'Pagamento', level: 1 })).toBeVisible()
    await expectNoAxeViolations(page)
    await noHorizontalOverflow(page)

    await page.goto('/profile')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoAxeViolations(page)
    await noHorizontalOverflow(page)

    await page.goto('/wallets')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoAxeViolations(page)
    await noHorizontalOverflow(page)
  })

  test('confirmação de pedido sem violações axe', async ({ page }) => {
    await loginAs(page, ANA, `/nft/${NFT}`)
    await addToCart(page)
    await page.goto('/cart')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await page.getByRole('dialog', { name: /KurioWallet/ }).getByRole('button', { name: 'Conectar', exact: true }).click()
    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await page.getByRole('button', { name: 'Confirmar pagamento' }).click()
    await expect(page.getByTestId('order')).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    await expectNoAxeViolations(page)
    await noHorizontalOverflow(page)
  })

  test('teclado: skip/tab chega ao conteúdo com foco visível', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    // Primeiro Tab cai num elemento interativo com indicador de foco visível.
    await page.keyboard.press('Tab')
    const first = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      return {
        tag: el.tagName,
        focusVisible: el.matches(':focus-visible'),
        outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
        ring: s.boxShadow !== 'none',
      }
    })
    expect(first).not.toBeNull()
    expect(first!.focusVisible).toBe(true)
    expect(first!.outline || first!.ring).toBe(true)

    // Todos os focáveis por Tab têm indicador visível (amostra das 25 primeiras paradas).
    const missing: string[] = []
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return null
        // Indicador pode estar no próprio elemento, no ::after (cards com link esticado) ou no wrapper (:focus-within).
        const ring = (s: CSSStyleDeclaration) =>
          (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'
        const visible =
          ring(getComputedStyle(el)) ||
          ring(getComputedStyle(el, '::after')) ||
          (el.parentElement !== null && ring(getComputedStyle(el.parentElement)))
        return visible ? null : `${el.tagName}.${el.className.toString().slice(0, 40)} "${el.textContent?.trim().slice(0, 20)}"`
      })
      if (info) missing.push(info)
    }
    expect(missing).toEqual([])
  })

  test('teclado: card do catálogo abre o detalhe e adiciona ao carrinho só com Enter', async ({ page }) => {
    await page.goto('/')
    const link = page.getByTestId('nft-card').first().getByRole('link').first()
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\//)
    const add = page.getByRole('button', { name: 'Adicionar ao carrinho' })
    await add.focus()
    await page.keyboard.press('Enter')
    await expect(live(page)).toContainText('no carrinho')
  })

  test('formulário de login: erros anunciados, associados e foco no primeiro inválido', async ({ page }) => {
    await page.goto('/login')
    const email = page.getByLabel('E-mail', { exact: true })
    await email.focus()
    await page.keyboard.press('Enter') // envia vazio pelo teclado
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toBeFocused()
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const message = page.locator(`[id="${describedBy!.split(' ')[0]}"]`)
    await expect(message).not.toBeEmpty()

    await email.fill('nao-e-email')
    await page.getByLabel('Senha', { exact: true }).fill('x')
    await page.keyboard.press('Enter')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expectNoAxeViolations(page)
  })

  test('formulário de cadastro: validação por campo acessível', async ({ page }) => {
    await page.goto('/register')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    const invalid = page.locator('[aria-invalid="true"]')
    await expect(invalid.first()).toBeVisible()
    expect(await invalid.count()).toBeGreaterThanOrEqual(3)
    // Cada campo inválido aponta para uma mensagem existente e não vazia.
    for (const el of await invalid.all()) {
      const ids = (await el.getAttribute('aria-describedby'))?.split(' ') ?? []
      expect(ids.length).toBeGreaterThan(0)
      await expect(page.locator(`[id="${ids[0]}"]`)).not.toBeEmpty()
    }
    await expect(invalid.first()).toBeFocused()
  })

  // O sheet de filtros só existe abaixo de lg: roda só no projeto mobile (filtro em playwright.config).
  test('sheet de filtros (Radix Dialog) prende o foco, Esc fecha e devolve o foco @mobile-only', async ({ page }) => {
    await page.goto('/')
    const trigger = page.getByRole('button', { name: /^Filtros/ })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Filtros' })
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await expectNoAxeViolations(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('popup da carteira simulada: foco inicial no diálogo, Esc recusa e o foco volta ao botão', async ({ page }) => {
    await loginAs(page, ANA, `/nft/${NFT}`)
    await addToCart(page)
    await page.goto('/cart')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    const trigger = page.getByRole('button', { name: 'Conectar carteira' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: /KurioWallet/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Conectar', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('prefers-reduced-motion desliga animações e shimmer', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    const animated = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('*')].filter((el) => {
        const s = getComputedStyle(el)
        const dur = Math.max(...s.animationDuration.split(',').map((d) => parseFloat(d) || 0))
        return s.animationName !== 'none' && dur > 0.01
      }).length,
    )
    expect(animated).toBe(0)
  })

  // Desktop a 200% = viewport 720×450; o mobile já é 390px.
  test('zoom 200% (viewport pela metade) mantém conteúdo sem overflow horizontal @desktop-only', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 450 })
    for (const path of ['/', `/nft/${NFT}`, '/cart', '/login', '/register']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await noHorizontalOverflow(page)
    }
  })

  // Define o próprio viewport: roda uma vez, no projeto desktop.
  test('tablet 768: telas principais sem violações axe e sem overflow horizontal @desktop-only', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await loginAs(page, ANA, `/nft/${NFT}`)
    await addToCart(page)
    for (const path of ['/', `/nft/${NFT}`, '/cart', '/checkout', '/profile', '/wallets']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await expectNoAxeViolations(page)
      await noHorizontalOverflow(page)
    }
  })

  test('imagens têm alt (vazio só se decorativas)', async ({ page }) => {
    for (const path of ['/', `/nft/${NFT}`]) {
      await page.goto(path)
      await expect(page.locator('main img').first()).toBeVisible()
      const missing = await page.locator('img:not([alt])').count()
      expect(missing, path).toBe(0)
    }
  })

  test('alt das artes descreve a imagem, não repete o título', async ({ page }) => {
    await page.goto('/')
    const card = page.getByTestId('nft-card').first()
    const cardTitle = await card.locator('h3').innerText()
    const cardAlt = (await card.locator('img').getAttribute('alt')) ?? ''
    expect(cardAlt).toMatch(/^Ilustração de um /)
    expect(cardAlt).not.toContain(cardTitle)

    await page.goto('/nft/nft-001')
    const title = await page.getByRole('heading', { level: 1 }).innerText()
    // Imagem principal da galeria (os cards de "Mais desta coleção" repetem artes).
    const main = page.locator('img[width="404"]')
    await expect(main).toHaveAttribute('alt', /macaco de pelo castanho com óculos redondos/)
    // Trocar a miniatura troca o alt junto com a arte.
    await page.getByRole('button', { name: 'Ver imagem 2 de 3' }).click()
    await expect(main).toHaveAttribute('alt', /gorila de pelo cinza/)
    expect(await main.getAttribute('alt')).not.toContain(title)
  })
})
