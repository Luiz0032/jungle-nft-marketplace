import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown, Loader2, Pencil, Plus, Star } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormAlert, FormField, inputClass, labelClass, outlineButtonClass, primaryButtonClass, RequiredMark } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { CreateWalletInputSchema, NETWORKS, type Wallet } from '@/contracts'
import { applyServerError } from '@/features/auth/components/form-errors'
import { AccountShell } from '@/features/profile/components/account-shell'
import { NETWORK_LABEL, shortAddress, useCreateWallet, useUpdateWallet, walletsQuery } from '@/features/wallets/queries'
import { notify } from '@/lib/notify'
import { usePageMeta } from '@/lib/page-meta'

/**
 * Carteiras — Figma desktop 9:1670 (sem frame mobile): sidebar "Meu perfil", lista e formulário em duas colunas,
 * sem cartões. "Exatamente uma primária" é regra do servidor; a UI só oferece "Tornar primária" (nunca desmarcar).
 */
export const Route = createFileRoute('/_auth/wallets')({
  component: WalletsPage,
})

const block = 'flex flex-col gap-5'
const blockTitle = 'text-base leading-5 font-bold text-foreground'

function WalletsPage() {
  usePageMeta('Carteiras', 'Gerencie as carteiras usadas para receber seus NFTs.')
  const { session } = Route.useRouteContext()
  const userId = session.user.id
  const wallets = useQuery(walletsQuery(userId))

  return (
    <AccountShell active="wallets">
      <section aria-labelledby="page-title" className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 id="page-title" className="text-base leading-5 font-bold text-foreground">
            Carteiras
          </h1>
          <p className="text-sm text-muted-foreground">
            Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados. Sempre há exatamente uma primária.
          </p>
        </div>

        <section aria-labelledby="wallets-list-title" className={block} aria-busy={wallets.isFetching}>
          <h2 id="wallets-list-title" className={blockTitle}>
            Minhas carteiras
          </h2>
          {wallets.isPending ? (
            <div className="flex flex-col gap-3" role="status" aria-label="Carregando carteiras">
              {[0, 1].map((i) => (
                <div key={i} className="shimmer h-[92px] rounded-md" />
              ))}
            </div>
          ) : wallets.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-coral">Não foi possível carregar suas carteiras.</p>
              <Button variant="outline" onClick={() => void wallets.refetch()}>
                Tentar de novo
              </Button>
            </div>
          ) : wallets.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma carteira cadastrada. Adicione a primeira ao lado.</p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Carteiras cadastradas">
              {wallets.data.map((wallet) => (
                <WalletRow key={wallet.id} userId={userId} wallet={wallet} />
              ))}
            </ul>
          )}
        </section>
        <AddWalletForm userId={userId} isFirst={wallets.data?.length === 0} />
      </section>
    </AccountShell>
  )
}

// ——— Linha da lista ———

const LabelFormSchema = CreateWalletInputSchema.pick({ label: true })
type LabelFormValues = z.infer<typeof LabelFormSchema>

function WalletRow({ userId, wallet }: { userId: string; wallet: Wallet }) {
  const id = useId()
  const update = useUpdateWallet(userId)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string>()
  const form = useForm<LabelFormValues>({ resolver: zodResolver(LabelFormSchema), defaultValues: { label: wallet.label } })

  /** Ao sair da edição, o foco volta para o botão "Editar" — num efeito, depois do commit que o remonta. */
  const editButton = useRef<HTMLButtonElement>(null)
  const [focusTick, setFocusTick] = useState(0)
  useEffect(() => {
    if (editing) form.setFocus('label')
  }, [editing, form])
  useEffect(() => {
    if (focusTick > 0) editButton.current?.focus()
  }, [focusTick])
  const focusEdit = () => setFocusTick((t) => t + 1)

  function stopEditing() {
    setEditing(false)
    form.reset({ label: wallet.label })
    focusEdit()
  }

  const onSave = form.handleSubmit(async ({ label }) => {
    if (label === wallet.label) return stopEditing()
    try {
      await update.mutateAsync({ id: wallet.id, label })
      notify.success('Carteira renomeada.')
      setEditing(false)
      focusEdit()
    } catch (e) {
      applyServerError(form, e, ['label'])
    }
  })

  async function makePrimary() {
    setError(undefined)
    try {
      await update.mutateAsync({ id: wallet.id, primary: true })
      notify.success(`${wallet.label} agora é a carteira primária.`)
    } catch {
      setError('Não foi possível tornar esta carteira primária. Tente de novo.')
    }
  }

  return (
    <li
      data-testid="wallet-row"
      data-primary={wallet.primary}
      className="flex flex-col gap-3 rounded-[2px] border border-border-soft p-4 data-[primary=true]:border-primary"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-foreground">
            <span className="truncate" data-testid="wallet-label">
              {wallet.label}
            </span>
            {wallet.primary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-brand">
                <Star className="size-3 fill-current" aria-hidden />
                Primária
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {NETWORK_LABEL[wallet.network]} ·{' '}
            <span className="font-mono" title={wallet.address}>
              {shortAddress(wallet.address)}
            </span>
          </p>
        </div>
        {!editing && (
          <div className="flex flex-wrap gap-2">
            <button
              ref={editButton}
              id={`${id}-edit`}
              type="button"
              onClick={() => setEditing(true)}
              className={`${outlineButtonClass} h-9 px-3`}
            >
              <Pencil className="size-4" aria-hidden />
              Editar<span className="sr-only"> nome de {wallet.label}</span>
            </button>
            {!wallet.primary && (
              <button
                type="button"
                onClick={() => void makePrimary()}
                disabled={update.isPending}
                className={`${outlineButtonClass} h-9 px-3`}
              >
                {update.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
                Tornar primária<span className="sr-only"> ({wallet.label})</span>
              </button>
            )}
          </div>
        )}
      </div>
      {editing && (
        <form
          onSubmit={(e) => void onSave(e)}
          onKeyDown={(e) => e.key === 'Escape' && stopEditing()}
          noValidate
          className="flex flex-col gap-3"
          aria-label={`Editar ${wallet.label}`}
        >
          <FormField id={`${id}-label`} label="Nome da carteira" error={form.formState.errors.label?.message} {...form.register('label')} />
          <FormAlert message={form.formState.errors.root?.server?.message} />
          <div className="flex gap-2">
            <button type="submit" disabled={update.isPending} className={`${primaryButtonClass} h-9`}>
              {update.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
              Salvar
            </button>
            <button type="button" onClick={stopEditing} className={`${outlineButtonClass} h-9`}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      <FormAlert message={error} />
    </li>
  )
}

// ——— Adicionar ———

const AddFormSchema = CreateWalletInputSchema.required({ primary: true })
type AddFormValues = z.infer<typeof AddFormSchema>
const EMPTY: AddFormValues = { label: '', address: '', network: 'ethereum', primary: false }

function AddWalletForm({ userId, isFirst }: { userId: string; isFirst: boolean }) {
  const id = useId()
  const create = useCreateWallet(userId)
  const form = useForm<AddFormValues>({ resolver: zodResolver(AddFormSchema), defaultValues: EMPTY })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values)
      form.reset(EMPTY)
      notify.success(`Carteira ${values.label} adicionada.`)
    } catch (error) {
      applyServerError(form, error, ['label', 'address', 'network'])
    }
  })

  return (
    <section aria-labelledby={`${id}-title`} className={block}>
      <h2 id={`${id}-title`} className={blockTitle}>
        Adicionar carteira
      </h2>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-x-7">
          <FormField id={`${id}-label`} label="Nome da carteira" requiredMark placeholder="Ex.: MetaMask" error={errors.label?.message} {...form.register('label')} />
          <div className="flex flex-col gap-2">
            <div className="flex">
              <label htmlFor={`${id}-network`} className={labelClass}>
                Rede
              </label>
              <RequiredMark />
            </div>
            <div className="relative">
              <select id={`${id}-network`} className={`${inputClass} appearance-none pr-10 [&>option]:bg-surface`} {...form.register('network')}>
                {NETWORKS.map((n) => (
                  <option key={n} value={n}>
                    {NETWORK_LABEL[n]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-foreground" aria-hidden />
            </div>
          </div>
          <FormField
            id={`${id}-address`}
            label="Endereço"
            requiredMark
            placeholder="Endereço 0x da carteira"
            autoComplete="off"
            spellCheck={false}
            className="font-mono lg:col-span-2"
            error={errors.address?.message}
            {...form.register('address')}
          />
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground has-[:disabled]:cursor-default">
          {/* Figma: marcador redondo com contorno primary ("Igual à carteira principal"); checkbox nativo estilizado. */}
          <input
            type="checkbox"
            className="grid size-[18px] cursor-pointer appearance-none place-items-center rounded-full border-2 border-primary outline-none before:size-2 before:rounded-full before:bg-primary before:opacity-0 checked:before:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:before:opacity-100"
            {...form.register('primary')}
            disabled={isFirst}
          />
          {isFirst ? 'Primeira carteira: será a primária' : 'Definir como primária'}
        </label>
        <FormAlert message={errors.root?.server?.message} />
        <button type="submit" disabled={create.isPending} className={`${primaryButtonClass} self-start px-6`}>
          {create.isPending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Adicionar carteira
        </button>
      </form>
    </section>
  )
}
