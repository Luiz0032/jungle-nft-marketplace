const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

export function randomHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** SHA-256(salt:senha) via crypto.subtle. Senha em texto puro nunca é persistida (invariante 6). */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  return toHex(await crypto.subtle.digest('SHA-256', data))
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const candidate = await hashPassword(password, salt)
  // Comparação de tempo constante (didático; no mock não há canal lateral real).
  let diff = candidate.length ^ hash.length
  for (let i = 0; i < Math.min(candidate.length, hash.length); i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i)
  return diff === 0
}
