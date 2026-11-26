import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Relógio controlado (`page.clock`). O servidor mock (handlers MSW, `delay()`, assentamento de pedidos,
 * emissões do Socket.IO) e o TanStack Query rodam na página, então com o relógio pausado nada que dependa
 * de timer acontece até o teste avançar o tempo. O timeout do Axios é do XHR nativo e NÃO é afetado.
 */

/** Instala o relógio falso no horário real atual e pausa. Chame antes de `page.goto` da tela testada. */
export async function pauseClock(page: Page) {
  const now = Date.now()
  await page.clock.install({ time: now })
  await page.clock.pauseAt(now + 1_000)
}

/** Pausa um relógio já instalado (`page.clock.install()` com tempo fluindo) no instante atual da página. */
export async function freezeClock(page: Page) {
  const now = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(now + 100)
}

/**
 * Avança o relógio em passos curtos até `check` passar. Cada requisição passa pelo Service Worker
 * (assíncrono, em tempo real) antes de o handler agendar o `delay()`; por isso um único `runFor` grande
 * pode terminar antes de o timer existir. `maxMs` limita o tempo FALSO avançado.
 */
export async function advanceUntil(page: Page, check: () => Promise<void>, { step = 250, maxMs = 30_000 } = {}) {
  let advanced = 0
  await expect(async () => {
    if (advanced < maxMs) {
      await page.clock.runFor(step)
      advanced += step
    }
    await check()
  }).toPass({ timeout: 20_000, intervals: [50] })
  return advanced
}

export const advanceUntilVisible = (page: Page, target: Locator, opts?: { step?: number; maxMs?: number }) =>
  advanceUntil(page, () => expect(target).toBeVisible({ timeout: 100 }), opts)
