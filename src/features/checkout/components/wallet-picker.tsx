import { Link } from '@tanstack/react-router'
import { CheckCircle2, Unplug, Wallet as WalletIcon } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { NETWORKS, type Network, type Wallet } from '@/contracts'
import { walletConnection, WalletConnectError, type Connection } from '@/features/wallets/connection'
import { NETWORK_LABEL, shortAddress } from '@/features/wallets/queries'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'

const radio =
  'flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 text-sm outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring'

/**
 * Rede → carteiras daquela rede → conexão com a extensão. O pedido exige carteira da mesma rede (contrato) e
 * conectada. Conectar/recusar acontece NA extensão; aqui só refletimos o resultado.
 */
export function WalletPicker({
  userId,
  wallets,
  network,
  walletId,
  connection,
  onNetwork,
  onWallet,
  error,
}: {
  userId: string
  wallets: Wallet[]
  network: Network
  walletId: string | null
  connection: Connection | null
  onNetwork: (n: Network) => void
  onWallet: (id: string) => void
  error?: string
}) {
  const id = useId()
  const [connecting, setConnecting] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const inNetwork = wallets.filter((w) => w.network === network)
  const selected = inNetwork.find((w) => w.id === walletId) ?? null
  const connected = Boolean(selected && connection?.walletId === selected.id)

  const connect = async () => {
    if (!selected) return
    setConnecting(true)
    setConnectError(null)
    try {
      await walletConnection.connect(userId, selected)
      notify.success(`Carteira ${selected.label} conectada.`)
    } catch (e) {
      const message = e instanceof WalletConnectError ? e.message : 'Não foi possível conectar a carteira.'
      setConnectError(message)
      notify.error(message)
    } finally {
      setConnecting(false)
      // O botão fica desabilitado enquanto o popup está aberto (ou some ao conectar): devolve o foco
      // à ação que estiver no cartão ("Desconectar" ou "Conectar carteira") em vez de deixá-lo no body.
      requestAnimationFrame(() => statusRef.current?.querySelector<HTMLButtonElement>('button')?.focus())
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-base font-bold text-foreground">Rede</legend>
        <div className="grid grid-cols-3 gap-2">
          {NETWORKS.map((n) => (
            <label
              key={n}
              className={cn(radio, 'justify-center', n === network ? 'border-primary bg-surface-dark font-bold text-brand' : 'border-border-soft text-foreground')}
            >
              <input type="radio" name={`${id}-network`} value={n} checked={n === network} onChange={() => onNetwork(n)} className="sr-only" />
              {NETWORK_LABEL[n]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3" aria-describedby={error ? `${id}-error` : undefined}>
        <legend className="mb-3 text-base font-bold text-foreground">Carteira</legend>
        {inNetwork.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border-soft p-4 text-sm text-muted-foreground">
            Nenhuma carteira cadastrada na rede {NETWORK_LABEL[network]}. Escolha outra rede ou{' '}
            <Link to="/wallets" className="text-brand underline-offset-2 hover:underline">
              cadastre uma carteira
            </Link>
            .
          </p>
        ) : (
          inNetwork.map((w) => (
            <label key={w.id} className={cn(radio, w.id === walletId ? 'border-primary bg-surface-dark' : 'border-border-soft')}>
              <input
                type="radio"
                name={`${id}-wallet`}
                value={w.id}
                checked={w.id === walletId}
                onChange={() => onWallet(w.id)}
                className="size-4 accent-primary"
              />
              <WalletIcon className="size-5 shrink-0 text-brand" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="text-foreground">
                  {w.label}
                  {w.primary && <span className="ml-2 text-xs text-subtle">(principal)</span>}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{shortAddress(w.address)}</span>
              </span>
            </label>
          ))
        )}
        {error && (
          <p id={`${id}-error`} className="text-sm text-coral">
            {error}
          </p>
        )}
      </fieldset>

      {selected && (
        <div ref={statusRef} className="flex flex-col gap-2 rounded-[10px] bg-surface p-4" aria-live="polite">
          <p className="text-[9px] font-bold tracking-[0.1px] text-subtle">METAMASK • WALLETCONNECT • COINBASE</p>
          {connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-success" data-testid="wallet-status">
                <CheckCircle2 className="size-4" aria-hidden />
                Conectada: {selected.label} · <span className="font-mono">{shortAddress(selected.address)}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  void walletConnection.disconnect(userId)
                  notify.info(`Carteira ${selected.label} desconectada.`)
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-coral focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Unplug className="size-4" aria-hidden />
                Desconectar
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" data-testid="wallet-status">
                Não conectada. Aprove a conexão na sua carteira.
              </p>
              <button
                type="button"
                onClick={() => void connect()}
                disabled={connecting}
                className="h-10 rounded-md border border-primary px-4 text-sm font-bold text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {connecting ? 'Aguardando a carteira…' : 'Conectar carteira'}
              </button>
            </div>
          )}
          {connectError && !connected && (
            <p role="alert" className="text-sm text-coral">
              {connectError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
