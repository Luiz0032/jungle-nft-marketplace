import { z } from 'zod'

/** Search params de /login e /register. */
export const AuthSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(['expired']).optional().catch(undefined),
})
export type AuthSearch = z.infer<typeof AuthSearchSchema>

const AUTH_PAGES = /^\/(login|register)(?:[/?#]|$)/

/**
 * Destino pós-login seguro: só caminho relativo da própria app (bloqueia `//evil.com`, `/\evil`,
 * `https://…` e loops para /login).
 */
export function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return '/'
  if (AUTH_PAGES.test(target)) return '/'
  return target
}
