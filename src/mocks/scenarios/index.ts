import { delay, HttpResponse } from 'msw'
import { createRng, hashString } from '@/mocks/lib/random'

/**
 * Cenários de mock (ARCHITECTURE §9). Estado em sessionStorage → sobrevive a refresh, isolado por aba.
 * Aleatoriedade (latência, falhas do `flaky`) vem de um PRNG semeado por cenário + contador de requisições:
 * mesmo cenário + mesma sequência de chamadas → mesmo resultado.
 */
export const SCENARIOS = [
  'default',
  'slow',
  'flaky',
  'offline',
  'out-of-order',
  'empty',
  'session-expired',
  'price-change',
  'sold-out',
  'order-timeout',
  'payment-declined',
  'socket-drop',
] as const
export type ScenarioName = (typeof SCENARIOS)[number]

export const isScenario = (v: unknown): v is ScenarioName => SCENARIOS.includes(v as ScenarioName)

type ScenarioState = {
  name: ScenarioName
  requestCount: number
  searchCount: number
  /** Efeitos que disparam uma única vez por ativação do cenário. */
  consumed: string[]
}

const STORAGE_KEY = 'jungle-mock-scenario'
const fresh = (name: ScenarioName): ScenarioState => ({
  name,
  requestCount: 0,
  searchCount: 0,
  consumed: [],
})

let state: ScenarioState = load()

function load(): ScenarioState {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as ScenarioState | null
    if (parsed && isScenario(parsed.name) && Array.isArray(parsed.consumed)) return parsed
  } catch {
    /* estado corrompido → default */
  }
  return fresh('default')
}

function save() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const getScenario = (): ScenarioName => state.name

export function setScenario(name: ScenarioName) {
  if (!isScenario(name)) throw new Error(`Cenário desconhecido: ${String(name)}. Use: ${SCENARIOS.join(', ')}`)
  state = fresh(name)
  save()
}

export const resetScenario = () => setScenario('default')

/** `?scenario=<nome>` seleciona (e persiste na sessão). */
export function initScenarioFromUrl(url: URL) {
  const requested = url.searchParams.get('scenario')
  if (requested && isScenario(requested)) setScenario(requested)
}

/** Latência da chamada de criação de pedido no `order-timeout`: maior que o timeout do Axios (10 s). */
export const ORDER_TIMEOUT_HANG_MS = 15_000

/** Tempo até o pedido sair de `pending`. */
export const orderSettleDelayMs = () => (state.name === 'slow' ? 5_000 : 2_000)

/** `session-expired`: a PRÓXIMA chamada privada (uma vez) encontra a sessão expirada. */
export function consumeSessionExpiry(): boolean {
  return consumeOnce('session-expired', 'session-expired')
}

/** true na primeira chamada enquanto `scenario` estiver ativo; false depois (ou em outro cenário). */
export function consumeOnce(scenario: ScenarioName, effect: string): boolean {
  if (state.name !== scenario || state.consumed.includes(effect)) return false
  state.consumed.push(effect)
  save()
  return true
}

/** `price-change`: atraso entre a cotação e o evento de mudança de preço. */
export const PRICE_CHANGE_DELAY_MS = 3_000
/** `socket-drop`: quanto tempo o servidor recusa reconexões depois de derrubar o socket. */
export const SOCKET_OUTAGE_MS = 3_000

function latencyFor(method: string, path: string, rand: number): number {
  switch (state.name) {
    case 'slow':
      return 2_000 + Math.round(rand * 2_000)
    case 'out-of-order':
      if (method === 'GET' && path === '/nfts') {
        // Respostas mais antigas chegam depois: 2,5 s, 1,8 s, 1,1 s, 0,4 s, 0,15 s…
        const ms = Math.max(150, 2_500 - 700 * state.searchCount)
        state.searchCount += 1
        return ms
      }
      return 150 + Math.round(rand * 250)
    default:
      return 150 + Math.round(rand * 250)
  }
}

/**
 * Efeitos de rede aplicados a TODA rota `/api`. Retorna uma resposta para curto-circuitar, ou `null`.
 */
export async function applyNetworkEffects(method: string, path: string): Promise<Response | null> {
  const rng = createRng(hashString(state.name) + state.requestCount)
  state.requestCount += 1
  const latency = latencyFor(method, path, rng.next())
  const failRoll = rng.next()
  save()

  if (state.name === 'offline') return HttpResponse.error()
  await delay(latency)
  if (state.name === 'flaky' && method === 'GET' && failRoll < 0.3) {
    return HttpResponse.json(
      { code: 'TRANSIENT', message: 'Serviço temporariamente indisponível. Tente novamente.' },
      { status: 503 },
    )
  }
  return null
}
