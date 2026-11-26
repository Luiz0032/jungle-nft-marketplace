import type { Edition, RealtimeEvent } from '@/contracts'
import { persist, resetDb } from '@/mocks/db'
import { updateEdition } from '@/mocks/handlers/domain'
import { getScenario, resetScenario, SCENARIOS, setScenario, type ScenarioName } from '@/mocks/scenarios'
import { dropConnections, emitRaw, resetSocketServer, socketStats, type EmitInput } from '@/mocks/socket'

/**
 * Controle programático do servidor mock (Playwright / painel de dev). Só existe com mocks ligados.
 * Nada aqui toca a UI ou o cache da app: mudanças passam pelo "backend" e eventos saem pelo servidor Socket.IO.
 */
export type MockControl = {
  scenarios: readonly ScenarioName[]
  getScenario: () => ScenarioName
  setScenario: (name: ScenarioName) => void
  /** Recria o banco a partir do seed, volta ao cenário `default` e limpa o log do socket. */
  reset: () => Promise<void>
  /** Altera preço/estoque NO BANCO; o servidor emite `nft.updated` pelo socket (como uma venda real). */
  updateEdition: (editionId: string, patch: Partial<Pick<Edition, 'price' | 'available'>>) => void
  /** Emite um evento arbitrário PELO servidor socket (dedupe/versão/usuário), sem tocar no banco. */
  emit: (event: EmitInput) => RealtimeEvent
  /** Derruba conexões e recusa reconexão por `outageMs` (padrão 3 s). */
  dropSockets: (opts?: { userId?: string; outageMs?: number }) => void
  socket: () => ReturnType<typeof socketStats>
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
      resetSocketServer()
    },
    updateEdition: (editionId, patch) => {
      updateEdition(editionId, patch)
      persist()
    },
    emit: emitRaw,
    dropSockets: ({ userId, outageMs = 3_000 } = {}) => dropConnections({ userId, outageMs }),
    socket: socketStats,
  }
}
