import { z } from 'zod'

/** Search params de /login e /register. */
export const AuthSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(['expired']).optional().catch(undefined),
})
export type AuthSearch = z.infer<typeof AuthSearchSchema>

const AUTH_PAGES = /^\/(login|register)(?:[/?#]|$)/

/**
 * Destino pós-login seguro: só caminho da própria origem (bloqueia `//evil.com`, `/\evil`, `/\t/evil`,
 * `https://…` e loops para /login). Resolve com o parser de URL do navegador — o mesmo que a navegação
 * usará — e devolve só path+search+hash normalizados.
 */
export function safeRedirect(target: string | undefined): string {
  // Controle (tab/CR/LF são removidos pelo parser e viram `//host`) e barra invertida: recusa.
  // eslint-disable-next-line no-control-regex
  if (!target || !target.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(target)) return '/'
  let url: URL
  try {
    url = new URL(target, window.location.origin)
  } catch {
    return '/'
  }
  if (url.origin !== window.location.origin) return '/'
  const path = `${url.pathname}${url.search}${url.hash}`
  return AUTH_PAGES.test(path) ? '/' : path
}
