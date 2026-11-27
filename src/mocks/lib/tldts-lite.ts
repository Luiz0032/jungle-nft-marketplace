/**
 * Substituto do `tldts` no bundle (alias em `vite.config.ts`). Quem o importa é só o `tough-cookie`,
 * que o MSW usa no cookie store dele para validar o domínio de cookies; o `tldts` completo embute a
 * Public Suffix List inteira (~258 kB, mais da metade do chunk do mock).
 * Nem a app nem o mock usam cookies (sessão é Bearer token), então a heurística "dois últimos rótulos"
 * basta. Efeito colateral aceito: o cookie store do MSW não reconhece sufixos privados (ex.: `vercel.app`).
 */
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

export function getDomain(hostname: string): string | null {
  const host = hostname.replace(/\.$/, '').toLowerCase()
  if (host === '' || IPV4.test(host) || host.includes(':')) return null
  const labels = host.split('.')
  if (labels.length < 2) return null
  return labels.slice(-2).join('.')
}
