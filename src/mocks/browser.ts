import { setupWorker } from 'msw/browser'
import { installMockControl } from '@/mocks/control'
import { initDb } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { resumePendingSettlements } from '@/mocks/handlers/order-engine'
import { initScenarioFromUrl, resetScenario } from '@/mocks/scenarios'
import { socketHandlers } from '@/mocks/socket'

export const worker = setupWorker(...handlers, ...socketHandlers)

/**
 * Sobe o "backend" mock: `?reset=1` recria o seed e volta ao cenário default;
 * `?scenario=<nome>` escolhe o cenário (persistido na sessão da aba).
 */
export async function startMocks() {
  const url = new URL(window.location.href)
  const reset = url.searchParams.get('reset') === '1'
  if (reset) resetScenario()
  initScenarioFromUrl(url)
  await initDb({ reset })
  resumePendingSettlements()
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  })
  // Só depois do worker ativo: `window.__mock` presente ⇒ requisições já são interceptadas.
  installMockControl()
}
