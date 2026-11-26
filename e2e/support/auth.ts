import { expect, type Page } from '@playwright/test'

export const ANA = { id: 'usr-ana', name: 'Ana Souza', email: 'ana@jungle.test', password: 'Senha@123' }
export const BRUNO = { id: 'usr-bruno', name: 'Bruno Lima', email: 'bruno@jungle.test', password: 'Senha@123' }

/** Preenche e envia o formulário de login já aberto. */
export async function submitLogin(page: Page, user: { email: string; password: string }) {
  await page.getByLabel('E-mail', { exact: true }).fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Login pela UI, voltando para `redirect`. */
export async function loginAs(page: Page, user: { email: string; password: string }, redirect = '/') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
  await submitLogin(page, user)
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024
