import { resetDb } from '@/mocks/db'
import { getScenario, resetScenario, SCENARIOS, setScenario, type ScenarioName } from '@/mocks/scenarios'

/**
 * Controle programático do servidor mock (Playwright / painel de dev).
 * Só existe com mocks ligados. Nunca altera estado da UI diretamente.
 * `emit` (emite PELO servidor Socket.IO mock).
 */
export type MockControl = {
  scenarios: readonly ScenarioName[]
  getScenario: () => ScenarioName
  setScenario: (name: ScenarioName) => void
  /** Recria o banco a partir do seed e volta ao cenário `default`. */
  reset: () => Promise<void>
}

declare global {
  interface Window {
    __mock?: MockControl
  }
}

export function installMockControl() {
  window.__mock = {
    scenarios: SCENARIOS,
    getScenario,
    setScenario,
    reset: async () => {
      await resetDb()
      resetScenario()
    },
  }
}
