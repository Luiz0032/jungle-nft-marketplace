import { createSeed } from './seed'
import type { DbState } from './types'

export type * from './types'

const STORAGE_KEY = 'jungle-mock-db:v2'
/** Chaves de seeds anteriores: apagadas no boot para não deixar lixo no localStorage. */
const LEGACY_KEYS = ['jungle-mock-db:v1']
let state: DbState | null = null

function load(): DbState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DbState
    return parsed.schemaVersion === 3 ? parsed : null
  } catch {
    return null
  }
}

/** Carrega do localStorage ou cria o seed determinístico. Chamado antes de `worker.start()`. */
export async function initDb({ reset = false }: { reset?: boolean } = {}) {
  for (const key of LEGACY_KEYS) localStorage.removeItem(key)
  state = reset ? null : load()
  if (!state) {
    state = await createSeed()
    persist()
  }
}

export function db(): DbState {
  if (!state) throw new Error('Mock DB não inicializado (chame initDb antes do worker.start)')
  return state
}

export function persist() {
  if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/** Reset completo: descarta tudo (usuários cadastrados, sessões, carrinhos, pedidos) e recria o seed. */
export async function resetDb() {
  await initDb({ reset: true })
}

/** IDs sequenciais determinísticos dentro do banco. */
export function nextId(prefix: string): string {
  const s = db()
  s.seq += 1
  return `${prefix}-${s.seq.toString(36).padStart(4, '0')}`
}
