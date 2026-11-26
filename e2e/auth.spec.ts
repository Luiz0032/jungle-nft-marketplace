import { expect, test, type Page } from '@playwright/test'
import { bootMock, setScenario } from './support/mock'

const ANA = { name: 'Ana Souza', email: 'ana@jungle.test', password: 'Senha@123' }
const BRUNO = { name: 'Bruno Lima', email: 'bruno@jungle.test', password: 'Senha@123' }

async function fillLogin(page: Page, user: { email: string; password: string }) {
  await page.getByLabel('E-mail', { exact: true }).fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

async function login(page: Page, user: { email: string; password: string }, redirect?: string) {
  await page.goto(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login')
  await fillLogin(page, user)
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible()
}

const socketUsers = (page: Page) =>
  page.evaluate(() => window.__mock!.socket().connections.map((c) => c.userId))

test.describe('auth @auth', () => {
  test.beforeEach(async ({ page }) => {
    await bootMock(page, 'default')
  })

  test('cadastro: validação nos campos, conflito de e-mail e sucesso', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { level: 1, name: 'Criar perfil de colecionador' })).toBeAttached()
    const submit = page.getByRole('button', { name: /^Criar (perfil|conta)$/ })

    // 1. vazio → erros associados aos campos
    await submit.click()
    const name = page.getByLabel('Nome de usuário')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toHaveAccessibleDescription('Informe ao menos 2 caracteres')
    await expect(page.getByLabel('Digite seu e-mail')).toHaveAccessibleDescription('Informe um e-mail válido')

    // 2. senha fraca e confirmação diferente
    await name.fill('Carla Dias')
    await page.getByLabel('Digite seu e-mail').fill(ANA.email)
    await page.getByLabel('Senha', { exact: true }).fill('curta')
    await page.getByLabel('Confirmar senha').fill('outra')
    await submit.click()
    await expect(page.getByLabel('Senha', { exact: true })).toHaveAccessibleDescription(
      'A senha precisa ter ao menos 8 caracteres',
    )
    await expect(page.getByLabel('Confirmar senha')).toHaveAccessibleDescription('As senhas não conferem')

    // 3. e-mail já cadastrado → erro do servidor no campo, com foco
    await page.getByLabel('Senha', { exact: true }).fill('Segura123')
    await page.getByLabel('Confirmar senha').fill('Segura123')
    await submit.click()
    const email = page.getByLabel('Digite seu e-mail')
    await expect(email).toHaveAccessibleDescription('Este e-mail já está cadastrado.')
    await expect(email).toBeFocused()

    // 4. sucesso → logado e de volta ao início
    await email.fill('carla@jungle.test')
    await submit.click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible()
    await expect(page.locator('#live-region')).toHaveText(/Conta criada/)
    await page.goto('/profile')
    await expect(page.getByTestId('profile-email')).toHaveText('carla@jungle.test')
  })

  test('login: credencial inválida, rota protegida redireciona e volta ao destino', async ({ page }) => {
    await page.goto('/profile?aba=dados')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile%3Faba%3Ddados$/)

    await fillLogin(page, { email: ANA.email, password: 'errada123' })
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.')

    await fillLogin(page, ANA)
    await expect(page).toHaveURL('/profile?aba=dados')
    await expect(page.getByTestId('profile-email')).toHaveText(ANA.email)
    expect(await socketUsers(page)).toEqual(['usr-ana'])
  })

  for (const evil of ['//evil.example.com/x', '/\\evil.example.com', '/\t/evil.example.com', '/.//evil.example.com', '/a/..//evil.example.com', 'https://evil.example.com']) {
    test(`redirect externo é ignorado (sem open redirect): ${JSON.stringify(evil)}`, async ({ page }) => {
      await login(page, ANA, evil)
      await expect(page).toHaveURL('/')
    })
  }

  test('refresh recupera a sessão via /auth/session', async ({ page }) => {
    await login(page, ANA, '/profile')
    const validated = page.waitForResponse((r) => r.url().endsWith('/api/auth/session') && r.status() === 200)
    await page.reload()
    await validated
    await expect(page).toHaveURL('/profile')
    await expect(page.getByTestId('profile-email')).toHaveText(ANA.email)
  })

  test('expiração durante a navegação preserva o destino', async ({ page }) => {
    await login(page, ANA, '/wallets')
    await expect(page).toHaveURL('/wallets')

    // Próxima chamada privada encontra a sessão expirada: GET /profile ao abrir o perfil
    // (rede assentada antes, para nenhuma query em voo consumir a expiração no lugar dele).
    await page.waitForLoadState('networkidle')
    await setScenario(page, 'session-expired')
    await page.getByRole('link', { name: /^Meu perfil \(/ }).click()

    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile&reason=expired$/)
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('jg:session'))).toBeNull()
    await expect.poll(() => socketUsers(page)).toEqual([null])

    await fillLogin(page, ANA)
    await expect(page).toHaveURL('/profile')
    await expect(page.getByTestId('profile-email')).toHaveText(ANA.email)
  })

  test('sessão expirada no refresh vai ao login guardando o destino', async ({ page }) => {
    await login(page, ANA, '/wallets?aba=rede')
    // O cenário vale na hora para a app aberta: sem esperar, uma query privada ainda em voo (carrinho do header)
    // consumiria a expiração ANTES do refresh, e o refresh já começaria como convidado (sem `reason=expired`).
    await page.waitForLoadState('networkidle')
    await setScenario(page, 'session-expired')
    await page.reload()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fwallets%3Faba%3Drede&reason=expired$/)
    await fillLogin(page, ANA)
    await expect(page).toHaveURL('/wallets?aba=rede')
  })

  test('logout limpa sessão, storage privado e socket', async ({ page }) => {
    await login(page, ANA, '/profile')
    await expect(page.getByTestId('profile-email')).toHaveText(ANA.email)
    await page.evaluate(() => {
      localStorage.setItem('jg:user:usr-ana:checkout-draft', '{"x":1}')
      sessionStorage.setItem('jg:user:usr-ana:idem', 'k')
      localStorage.setItem('jg:guest-cart', '[]') // público: sobrevive
    })

    await page.getByRole('button', { name: 'Sair', exact: true }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible()

    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage).filter((k) => k.startsWith('jg:')),
      session: Object.keys(sessionStorage).filter((k) => k.startsWith('jg:')),
    }))
    expect(storage).toEqual({ local: ['jg:guest-cart'], session: [] })
    await expect.poll(() => socketUsers(page)).toEqual([null])

    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile$/)
  })

  test('troca de usuário não vaza dados do anterior', async ({ page }) => {
    await login(page, ANA, '/profile')
    await expect(page.getByTestId('profile-email')).toHaveText(ANA.email)

    await page.getByRole('button', { name: 'Sair', exact: true }).click()
    await expect(page).toHaveURL('/')

    // Captura qualquer render do perfil durante o login do Bruno.
    const seen: string[] = []
    await page.exposeFunction('__seenProfile', (v: string) => seen.push(v))
    await page.evaluate(() => {
      new MutationObserver(() => {
        const el = document.querySelector('[data-testid="profile-email"]')
        if (el?.textContent) (window as unknown as { __seenProfile: (v: string) => void }).__seenProfile(el.textContent)
      }).observe(document.body, { subtree: true, childList: true, characterData: true })
    })

    // Navegação só no cliente (o observer precisa sobreviver).
    await page.getByRole('link', { name: 'Entrar' }).first().click()
    await fillLogin(page, BRUNO)
    await expect(page).toHaveURL('/')
    await page.getByRole('link', { name: /^Meu perfil \(/ }).click()
    await expect(page.getByTestId('profile-email')).toHaveText(BRUNO.email)
    await expect(page.getByTestId('profile-name')).toHaveText(BRUNO.name)
    expect(seen).not.toContain(ANA.email)
    await expect.poll(() => socketUsers(page)).toEqual(['usr-bruno'])
  })
})
