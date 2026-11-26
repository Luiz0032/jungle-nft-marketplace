import { toast } from 'sonner'

/**
 * Feedback de mutação/evento: toast (sonner) + região `aria-live` própria (`<LiveRegion />` no __root).
 * A região é independente do toast para leitores de tela anunciarem mesmo se o toast sumir rápido.
 */

export const LIVE_REGION_ID = 'live-region'

export function announce(message: string) {
  const el = document.getElementById(LIVE_REGION_ID)
  if (!el) return
  // Limpa e reescreve no próximo frame: garante novo anúncio mesmo com texto repetido.
  el.textContent = ''
  requestAnimationFrame(() => {
    el.textContent = message
  })
}

export const notify = {
  success(message: string) {
    toast.success(message)
    announce(message)
  },
  info(message: string) {
    toast.info(message)
    announce(message)
  },
  error(message: string) {
    toast.error(message)
    announce(message)
  },
}
