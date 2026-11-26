export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api',
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.jungle.mock',
  // Padrão `true`: a demo pública (Vercel) roda com mocks. Desligar só com VITE_ENABLE_MOCKS=false.
  enableMocks: (import.meta.env.VITE_ENABLE_MOCKS ?? 'true') !== 'false',
} as const
