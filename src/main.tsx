import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/app'
import { env } from '@/lib/env'
import './index.css'

async function enableMocking() {
  if (!env.enableMocks) return
  const { worker } = await import('@/mocks/browser')
  // Precisa terminar ANTES de criar o socket e renderizar (ver ARCHITECTURE §2).
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  })
}

void enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
