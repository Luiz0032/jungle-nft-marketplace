import type { z } from 'zod'

/**
 * Acesso a Web Storage com namespace e validação.
 * - `jg:session`: sessão atual (token + usuário).
 * - `jg:user:<userId>:*`: dados privados do usuário (rascunhos, chaves de idempotência…). Apagados no logout.
 * - Demais `jg:*` (ex.: carrinho de convidado) são públicos e sobrevivem ao logout.
 */

const PREFIX = 'jg:'
export const SESSION_KEY = `${PREFIX}session`
const PRIVATE_PREFIX = `${PREFIX}user:`

export const privateKey = (userId: string, name: string) => `${PRIVATE_PREFIX}${userId}:${name}`

type Area = 'local' | 'session'
const area = (a: Area): Storage | null => {
  try {
    return a === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null // modo privado / storage bloqueado
  }
}

export function readStorage<S extends z.ZodType>(key: string, schema: S, where: Area = 'local'): z.output<S> | null {
  const raw = area(where)?.getItem(key)
  if (raw == null) return null
  try {
    const parsed = schema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  } catch {
    // JSON inválido: trata como ausente
  }
  area(where)?.removeItem(key)
  return null
}

export function writeStorage(key: string, value: unknown, where: Area = 'local') {
  try {
    area(where)?.setItem(key, JSON.stringify(value))
  } catch {
    // cota excedida / bloqueado: segue só em memória
  }
}

export function removeStorage(key: string, where: Area = 'local') {
  area(where)?.removeItem(key)
}

/** Remove a sessão e TODO dado privado (de qualquer usuário) do localStorage e sessionStorage. */
export function clearPrivateStorage() {
  for (const where of ['local', 'session'] as const) {
    const s = area(where)
    if (!s) continue
    const keys: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (k && (k === SESSION_KEY || k.startsWith(PRIVATE_PREFIX))) keys.push(k)
    }
    for (const k of keys) s.removeItem(k)
  }
}
