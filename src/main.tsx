import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { env } from '@/lib/env'
import './index.css'

async function enableMocking() {
  if (!env.enableMocks) return
  const { startMocks } = await import('@/mocks/browser')
  // Precisa terminar ANTES de criar o socket e renderizar (ver ARCHITECTURE §2).
  await startMocks()
}

async function bootstrap() {
  await enableMocking()
  // Import dinâmico de propósito: o engine.io-client captura `globalThis.WebSocket` quando o módulo é
  // avaliado. Importar a app só depois do `worker.start()` garante que ele pegue o WebSocket do MSW.
  const { App } = await import('@/app/app')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
