import type { Page } from '@playwright/test'
import type { RealtimeEvent } from '../../src/contracts'

/** Espelho de `src/mocks/control.ts` para os specs (sem puxar MSW para o projeto node). */
type EmitInput = Omit<RealtimeEvent, 'eventId' | 'emittedAt' | 'userId'> & {
  eventId?: string
  emittedAt?: string
  userId?: string | null
}
type MockControl = {
  scenarios: readonly string[]
  getScenario: () => string
  setScenario: (name: string) => void
  reset: () => Promise<void>
  updateEdition: (editionId: string, patch: { price?: string; available?: number }) => void
  emit: (event: EmitInput) => RealtimeEvent
  dropSockets: (opts?: { userId?: string; outageMs?: number }) => void
  socket: () => { connections: { id: string; userId: string | null }[]; emitted: RealtimeEvent[] }
  orders: () => { id: string; userId: string; status: string; idempotencyKey: string }[]
  settleOrder: (orderId: string, outcome: 'confirmed' | 'rejected') => void
}
declare global {
  interface Window {
    __mock?: MockControl
  }
}

/** Abre a app, espera o worker MSW e reseta banco + cenário. */
export async function bootMock(page: Page, scenario = 'default') {
  await page.goto('/')
  await page.waitForFunction(() => window.__mock !== undefined)
  await page.evaluate(async (name) => {
    await window.__mock!.reset()
    window.__mock!.setScenario(name)
  }, scenario)
}

export async function setScenario(page: Page, scenario: string) {
  await page.evaluate((name) => window.__mock!.setScenario(name), scenario)
}

export type ApiResult = { status: number; body: unknown; networkError?: boolean }

/** Chamada REST crua de dentro da página (passa pelo Service Worker do MSW). */
export function api(
  page: Page,
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
): Promise<ApiResult> {
  return page.evaluate(
    async ({ method, path, body, token, headers }) => {
      try {
        const res = await fetch(`/api${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        const text = await res.text()
        return { status: res.status, body: text ? (JSON.parse(text) as unknown) : null }
      } catch {
        return { status: 0, body: null, networkError: true }
      }
    },
    { method, path, body: opts.body, token: opts.token, headers: opts.headers ?? {} },
  )
}

export async function login(page: Page, email = 'ana@jungle.test', password = 'Senha@123') {
  const res = await api(page, 'POST', '/auth/login', { body: { email, password } })
  if (res.status !== 200) throw new Error(`login falhou: ${res.status} ${JSON.stringify(res.body)}`)
  return (res.body as { token: string }).token
}
