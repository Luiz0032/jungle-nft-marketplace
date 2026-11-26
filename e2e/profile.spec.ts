import { expect, test, type Page } from '@playwright/test'
import { ANA, BRUNO, loginAs, submitLogin } from './support/auth'
import { api, bootMock, login } from './support/mock'

// PNG 1×1 válido.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const live = (page: Page) => page.locator('#live-region')
const avatarInput = (page: Page) => page.getByLabel('Alterar foto')

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('perfil @profile', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page)
    await loginAs(page, ANA, '/profile')
    await expect(page.getByRole('heading', { level: 1, name: 'Meu perfil' })).toBeVisible()
  })

  test('dados: validação, e-mail em uso e sucesso refletido no header e após refresh', async ({ page }) => {
    const name = page.getByLabel('Nome', { exact: true })
    const email = page.getByLabel('E-mail', { exact: true })
    const save = page.getByRole('button', { name: 'Salvar dados' })
    await expect(name).toHaveValue(ANA.name)
    await expect(save).toBeDisabled() // nada alterado

    await name.fill('A')
    await email.fill('nao-e-email')
    await save.click()
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toHaveAccessibleDescription('Informe ao menos 2 caracteres')
    await expect(email).toHaveAccessibleDescription('Informe um e-mail válido')

    // e-mail de outro usuário → 409 do servidor no campo
    await name.fill(ANA.name)
    await email.fill(BRUNO.email)
    await save.click()
    await expect(email).toHaveAccessibleDescription('Este e-mail já está em uso.')
    await expect(email).toBeFocused()

    await name.fill('Ana Paula Souza')
    await email.fill('ana.paula@jungle.test')
    await save.click()
    await expect(live(page)).toContainText('Dados atualizados.')
    await expect(page.getByTestId('profile-name')).toHaveText('Ana Paula Souza')
    await expect(page.getByRole('link', { name: 'Meu perfil (Ana Paula Souza)' })).toBeAttached()

    await page.reload()
    await expect(page.getByTestId('profile-email')).toHaveText('ana.paula@jungle.test')
    await noHorizontalOverflow(page)
  })

  test('avatar: recusa tipo e tamanho inválidos, aceita PNG e mostra no header', async ({ page }) => {
    const input = avatarInput(page)
    await input.setInputFiles({ name: 'foto.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
    await expect(input).toHaveAccessibleDescription(/Formato não suportado/)
    await expect(input).toHaveAttribute('aria-invalid', 'true')

    const big = Buffer.alloc(1024 * 1024 + 1, 0)
    await input.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: big })
    await expect(input).toHaveAccessibleDescription(/no máximo 1 MB/)

    await input.setInputFiles({ name: 'ok.png', mimeType: 'image/png', buffer: PNG_1PX })
    await expect(live(page)).toContainText('Foto de perfil atualizada.')
    await expect(input).not.toHaveAttribute('aria-invalid', 'true')
    const headerAvatar = page.getByRole('link', { name: /^Meu perfil/ }).locator('img')
    await expect(headerAvatar).toHaveAttribute('src', /^data:image\/png;base64,/)

    // o servidor também valida (não depende só do cliente)
    const token = await login(page)
    const res = await api(page, 'PUT', '/profile/avatar', { token, body: { dataUrl: 'data:image/gif;base64,R0lGOD==' } })
    expect(res.status).toBe(422)
  })

  test('senha: exige a atual, valida a nova e passa a valer no login', async ({ page }) => {
    const current = page.getByLabel('Senha atual')
    const next = page.getByLabel('Nova senha', { exact: true })
    const confirm = page.getByLabel('Confirmar nova senha')
    const submit = page.getByRole('button', { name: 'Alterar senha' })

    await submit.click()
    await expect(current).toHaveAccessibleDescription('Informe a senha atual')

    await current.fill(ANA.password)
    await next.fill('curta')
    await confirm.fill('curta')
    await submit.click()
    await expect(next).toHaveAccessibleDescription(/8 a 72 caracteres.*ao menos 8 caracteres/)

    await next.fill('NovaSenha123')
    await confirm.fill('OutraSenha123')
    await submit.click()
    await expect(confirm).toHaveAccessibleDescription('As senhas não coincidem')

    // senha atual errada → erro do servidor no campo
    await current.fill('Errada999')
    await confirm.fill('NovaSenha123')
    await submit.click()
    await expect(current).toHaveAccessibleDescription('Senha atual incorreta.')
    await expect(current).toBeFocused()

    await current.fill(ANA.password)
    await submit.click()
    await expect(live(page)).toContainText('Senha alterada')
    await expect(current).toHaveValue('')

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(live(page)).toContainText('Você saiu da conta.') // logout terminou (inclui o redirect para /)
    await page.goto('/login')
    await submitLogin(page, ANA)
    await expect(page.getByRole('alert')).toBeVisible() // senha antiga recusada
    await submitLogin(page, { email: ANA.email, password: 'NovaSenha123' })
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  })
})

test.describe('carteiras @profile', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page)
    await loginAs(page, ANA, '/wallets')
    await expect(page.getByRole('heading', { level: 1, name: 'Carteiras' })).toBeVisible()
  })

  const rows = (page: Page) => page.getByTestId('wallet-row')
  const primaryRows = (page: Page) => page.locator('[data-testid="wallet-row"][data-primary="true"]')

  test('adicionar: validação, duplicada e nova primária (sempre exatamente uma)', async ({ page }) => {
    await expect(rows(page)).toHaveCount(2)
    await expect(primaryRows(page)).toHaveCount(1)
    const form = page.getByRole('region', { name: 'Adicionar carteira' })
    const label = form.getByLabel('Nome da carteira')
    const address = form.getByLabel('Endereço')
    const submit = form.getByRole('button', { name: 'Adicionar carteira' })

    await submit.click()
    await expect(label).toHaveAccessibleDescription('Informe um nome')
    await expect(address).toHaveAccessibleDescription('Endereço inválido (0x + 40 hex)')

    // endereço já cadastrado na mesma rede → 409 no campo
    const token = await login(page)
    const existing = ((await api(page, 'GET', '/wallets', { token })).body as { address: string; network: string }[])[0]!
    await label.fill('Cópia')
    await address.fill(existing.address)
    await form.getByLabel('Rede').selectOption(existing.network)
    await submit.click()
    await expect(address).toHaveAccessibleDescription('Carteira já cadastrada nesta rede.')

    await label.fill('Ledger')
    await address.fill(`0x${'ab'.repeat(20)}`)
    await form.getByLabel('Rede').selectOption('base')
    await form.getByLabel('Definir como primária').check()
    await submit.click()
    await expect(live(page)).toContainText('Carteira Ledger adicionada.')
    await expect(rows(page)).toHaveCount(3)
    await expect(primaryRows(page)).toHaveCount(1)
    await expect(primaryRows(page).getByTestId('wallet-label')).toHaveText('Ledger')
    await expect(label).toHaveValue('')
    await noHorizontalOverflow(page)
  })

  test('editar nome e trocar a primária', async ({ page }) => {
    const polygon = rows(page).filter({ hasText: 'Carteira Polygon' })
    await polygon.getByRole('button', { name: 'Editar nome de Carteira Polygon' }).click()
    const field = polygon.getByLabel('Nome da carteira')
    await expect(field).toBeFocused()
    await field.fill('   ')
    await polygon.getByRole('button', { name: 'Salvar' }).click()
    await expect(field).toHaveAccessibleDescription('Informe um nome')

    await field.fill('Polygon de jogos')
    await polygon.getByRole('button', { name: 'Salvar' }).click()
    await expect(live(page)).toContainText('Carteira renomeada.')
    const renamed = rows(page).filter({ hasText: 'Polygon de jogos' })
    await expect(renamed.getByRole('button', { name: 'Editar nome de Polygon de jogos' })).toBeFocused()

    await renamed.getByRole('button', { name: 'Tornar Polygon de jogos primária' }).click()
    await expect(live(page)).toContainText('agora é a carteira primária')
    await expect(primaryRows(page)).toHaveCount(1)
    await expect(primaryRows(page).getByTestId('wallet-label')).toHaveText('Polygon de jogos')
    // a primária não oferece "tornar primária" (não dá para ficar sem nenhuma)
    await expect(renamed.getByRole('button', { name: /^Tornar/ })).toHaveCount(0)

    await page.reload()
    await expect(primaryRows(page).getByTestId('wallet-label')).toHaveText('Polygon de jogos')
    const token = await login(page)
    const list = (await api(page, 'GET', '/wallets', { token })).body as { primary: boolean }[]
    expect(list.filter((w) => w.primary)).toHaveLength(1)
  })
})
