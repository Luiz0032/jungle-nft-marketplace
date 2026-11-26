import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Loader2, Pencil, Plus, Star } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormAlert, FormField, inputClass, outlineButtonClass, primaryButtonClass } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { CreateWalletInputSchema, NETWORKS, type Wallet } from '@/contracts'
import { applyServerError } from '@/features/auth/components/form-errors'
import { NETWORK_LABEL, shortAddress, useCreateWallet, useUpdateWallet, walletsQuery } from '@/features/wallets/queries'
import { notify } from '@/lib/notify'

/**
 * Carteiras — Figma desktop 9:1670 (sem frame mobile). Sem referência visual nesta sessão:
 * tokens + padrões do checkout (ver ARCHITECTURE §12). "Exatamente uma primária" é regra do servidor;
 * a UI só oferece "Tornar primária" (nunca desmarcar).
 */
export const Route = createFileRoute('/_auth/wallets')({
  component: WalletsPage,
})

const card = 'flex flex-col gap-5 rounded-[10px] bg-surface p-5 lg:p-6'

function WalletsPage() {
  const { session } = Route.useRouteContext()
  const userId = session.user.id
  const wallets = useQuery(walletsQuery(userId))

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6 pt-2 pb-10 lg:pt-8">
      <nav aria-label="Trilha" className="hidden text-sm text-muted-foreground lg:block">
        <ol className="flex gap-1">
          <li>
            <Link to="/profile" className="rounded-sm hover:text-brand">
              Meu perfil
            </Link>
            <span aria-hidden> / </span>
          </li>
          <li aria-current="page" className="text-foreground">
            Carteiras
          </li>
        </ol>
      </nav>
      <div className="flex flex-col gap-1">
        <h1 id="page-title" className="text-[22px] leading-[29px] text-foreground lg:text-heading lg:font-bold">
          Carteiras
        </h1>
        <p className="text-sm text-muted-foreground">
          A carteira primária é a sugerida no pagamento. Sempre há exatamente uma.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <section aria-labelledby="wallets-list-title" className={card} aria-busy={wallets.isFetching}>
          <h2 id="wallets-list-title" className="text-lg font-bold text-foreground">
            Minhas carteiras
          </h2>
          {wallets.isPending ? (
            <div className="flex flex-col gap-3" aria-label="Carregando carteiras">
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
      </div>
    </section>
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

  useEffect(() => {
    if (editing) form.setFocus('label')
  }, [editing, form])

  /** Ao sair da edição, o foco volta para o botão "Editar" (que reaparece no próximo render). */
  const focusEdit = () => requestAnimationFrame(() => document.getElementById(`${id}-edit`)?.focus())

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
      className="flex flex-col gap-3 rounded-md border border-border-soft p-4 data-[primary=true]:border-primary"
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
              id={`${id}-edit`}
              type="button"
              onClick={() => setEditing(true)}
              className={`${outlineButtonClass} h-9 px-3`}
              aria-label={`Editar nome de ${wallet.label}`}
            >
              <Pencil className="size-4" aria-hidden />
              Editar
            </button>
            {!wallet.primary && (
              <button
                type="button"
                onClick={() => void makePrimary()}
                disabled={update.isPending}
                className={`${outlineButtonClass} h-9 px-3`}
                aria-label={`Tornar ${wallet.label} primária`}
              >
                {update.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
                Tornar primária
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
    <section aria-labelledby={`${id}-title`} className={`${card} lg:sticky lg:top-6`}>
      <h2 id={`${id}-title`} className="text-lg font-bold text-foreground">
        Adicionar carteira
      </h2>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        <FormField id={`${id}-label`} label="Nome da carteira" placeholder="Ex.: MetaMask" error={errors.label?.message} {...form.register('label')} />
        <FormField
          id={`${id}-address`}
          label="Endereço"
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          error={errors.address?.message}
          {...form.register('address')}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-network`} className="text-sm text-foreground">
            Rede
          </label>
          <select id={`${id}-network`} className={inputClass} {...form.register('network')}>
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {NETWORK_LABEL[n]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" className="size-4 accent-primary" {...form.register('primary')} disabled={isFirst} />
          {isFirst ? 'Primeira carteira: será a primária' : 'Definir como primária'}
        </label>
        <FormAlert message={errors.root?.server?.message} />
        <button type="submit" disabled={create.isPending} className={`${primaryButtonClass} h-[50px]`}>
          {create.isPending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Adicionar carteira
        </button>
      </form>
    </section>
  )
}
