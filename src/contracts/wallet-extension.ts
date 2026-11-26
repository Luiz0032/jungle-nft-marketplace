import type { Network } from './wallet'

/**
 * Contrato da extensão de carteira injetada no navegador (`window.kurioWallet`), no espírito do EIP-1193:
 * a página pede, o usuário aprova ou recusa NA EXTENSÃO. A app só fala com esta interface; em ambiente de
 * mock a extensão é simulada por `src/mocks/wallet-extension.ts` (com o próprio diálogo de aprovação).
 */
export type WalletConnectRequest = { address: string; network: Network; label: string; origin: string }
export type WalletConnection = { address: string; network: Network }

export interface WalletExtension {
  readonly name: string
  /** Pede conexão à conta. Rejeita com `{ code: 4001 }` se o usuário recusar. */
  connect(request: WalletConnectRequest): Promise<WalletConnection>
  disconnect(address: string): Promise<void>
}

/** Código EIP-1193 "User Rejected Request". */
export const USER_REJECTED = 4001

declare global {
  interface Window {
    kurioWallet?: WalletExtension
  }
}
