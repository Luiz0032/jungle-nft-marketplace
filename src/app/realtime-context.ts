import { createContext, useContext } from 'react'
import type { Realtime } from '@/lib/realtime'

export const RealtimeContext = createContext<Realtime | null>(null)

export function useRealtime(): Realtime {
  const realtime = useContext(RealtimeContext)
  if (!realtime) throw new Error('useRealtime fora do RealtimeContext')
  return realtime
}
