import { http, HttpResponse } from 'msw'
import { env } from '@/lib/env'

const api = (path: string) => `${env.apiUrl}${path}`

/** A versão completa substitui/expande com todas as rotas da seção 4 do ARCHITECTURE.md. */
export const handlers = [
  http.get(api('/health'), () => HttpResponse.json({ status: 'ok', mock: true })),
]
