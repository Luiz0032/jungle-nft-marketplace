import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/app'
import { env } from '@/lib/env'
import './index.css'

async function enableMocking() {
  if (!env.enableMocks) return
  const { startMocks } = await import('@/mocks/browser')
  // Precisa terminar ANTES de criar o socket e renderizar (ver ARCHITECTURE §2).
  await startMocks()
}

void enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
