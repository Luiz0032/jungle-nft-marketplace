import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Upload } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormAlert, FormField, primaryButtonClass } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  AvatarInputSchema,
  EmailSchema,
  NameSchema,
  PasswordSchema,
  type Profile,
} from '@/contracts'
import { applyServerError } from '@/features/auth/components/form-errors'
import { AccountShell } from '@/features/profile/components/account-shell'
import { UserAvatar } from '@/features/profile/components/user-avatar'
import { profileQuery, useChangePassword, useUpdateProfile, useUploadAvatar } from '@/features/profile/queries'
import { ApiRequestError } from '@/lib/http'
import { notify } from '@/lib/notify'

/**
 * Perfil do colecionador — Figma desktop 9:1238 (sem frame mobile): sidebar "Meu perfil" + formulário em duas
 * colunas, avatar à direita e "Alterar senha" à esquerda. Campos e botões sem cartão, como no Figma.
 */
export const Route = createFileRoute('/_auth/profile')({
  component: ProfilePage,
})

const block = 'flex flex-col gap-5'
const blockTitle = 'text-base leading-5 font-bold text-foreground'

function ProfilePage() {
  const { session } = Route.useRouteContext()
  const userId = session.user.id
  const profile = useQuery(profileQuery(userId))

  return (
    <AccountShell active="profile">
      <section aria-labelledby="page-title" className="flex flex-col gap-6">
        <h1 id="page-title" className="text-base leading-5 font-bold text-foreground">
          Perfil do colecionador
        </h1>

        {profile.isPending ? (
          <ProfileSkeleton />
        ) : profile.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-[10px] bg-surface p-6">
            <p className="text-coral">Não foi possível carregar seu perfil.</p>
            <Button variant="outline" onClick={() => void profile.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="grid gap-x-7 gap-y-10 lg:grid-cols-2" aria-busy={profile.isFetching}>
            {/* `key`: dados novos do servidor (outro dispositivo, refetch) recriam o formulário limpo. */}
            <ProfileForm key={`${profile.data.name}|${profile.data.email}`} profile={profile.data} />
            <div className="lg:col-start-2 lg:row-start-2">
              <AvatarCard profile={profile.data} />
            </div>
            <div className="lg:col-start-1 lg:row-start-2">
              <PasswordForm />
            </div>
          </div>
        )}
      </section>
    </AccountShell>
  )
}

// ——— Avatar ———

const ACCEPT = AVATAR_MIME_TYPES.join(',')
const MAX_MB = AVATAR_MAX_BYTES / (1024 * 1024)

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

/** Valida antes de enviar (tipo e tamanho); o servidor valida de novo com o mesmo schema. */
async function avatarDataUrl(file: File): Promise<{ dataUrl: string } | { error: string }> {
  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { error: 'Formato não suportado. Use uma imagem PNG, JPEG ou WebP.' }
  }
  if (file.size > AVATAR_MAX_BYTES) return { error: `A imagem deve ter no máximo ${MAX_MB} MB.` }
  const dataUrl = await readAsDataUrl(file)
  const parsed = AvatarInputSchema.safeParse({ dataUrl })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Imagem inválida.' }
  return { dataUrl }
}

function AvatarCard({ profile }: { profile: Profile }) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadAvatar(profile.id)
  const [error, setError] = useState<string>()
  const [reading, setReading] = useState(false)
  const busy = reading || upload.isPending

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    setError(undefined)
    setReading(true)
    const result = await avatarDataUrl(file).catch(() => ({ error: 'Não foi possível ler o arquivo.' }))
    setReading(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    try {
      await upload.mutateAsync(result)
      notify.success('Foto de perfil atualizada.')
    } catch (e) {
      setError(e instanceof ApiRequestError ? (e.fields?.dataUrl ?? e.message) : 'Não foi possível enviar a foto.')
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-2">
      <h2 id={`${id}-title`} className="text-[15px] leading-5 text-foreground">
        Avatar
      </h2>
      <div className="flex flex-wrap items-center gap-6">
        <UserAvatar user={profile} className="size-[50px] shrink-0 border border-border-soft text-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-foreground" data-testid="profile-name">
            {profile.name}
          </p>
          <p className="truncate text-sm text-muted-foreground" data-testid="profile-email">
            {profile.email}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          id={`${id}-file`}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          aria-invalid={error ? true : undefined}
          onChange={(e) => void onFile(e)}
          disabled={busy}
        />
        <label
          htmlFor={`${id}-file`}
          className={`${primaryButtonClass} w-fit cursor-pointer px-6 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 [input:focus-visible+&]:ring-2 [input:focus-visible+&]:ring-ring`}
          aria-disabled={busy || undefined}
        >
          {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {busy ? (
            'Enviando foto…'
          ) : (
            <>
              Alterar<span className="sr-only"> foto</span>
            </>
          )}
        </label>
        <p id={`${id}-hint`} className="text-xs text-subtle">
          PNG, JPEG ou WebP, até {MAX_MB} MB.
        </p>
        {error && (
          <p id={`${id}-error`} role="alert" className="text-xs text-coral">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

// ——— Dados ———

const ProfileFormSchema = z.object({ name: NameSchema, email: EmailSchema })
type ProfileFormValues = z.infer<typeof ProfileFormSchema>

function ProfileForm({ profile }: { profile: Profile }) {
  const id = useId()
  const update = useUpdateProfile(profile.id)
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: { name: profile.name, email: profile.email },
  })
  const { errors, isDirty } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    const dirty = form.formState.dirtyFields
    const input = { ...(dirty.name ? { name: values.name } : {}), ...(dirty.email ? { email: values.email } : {}) }
    if (!input.name && !input.email) return
    try {
      await update.mutateAsync(input)
      notify.success('Dados atualizados.')
    } catch (error) {
      applyServerError(form, error, ['name', 'email'])
    }
  })

  return (
    <section aria-labelledby={`${id}-title`} className={`${block} lg:col-span-2`}>
      <h2 id={`${id}-title`} className="sr-only">
        Dados pessoais
      </h2>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-x-7">
          <FormField id={`${id}-name`} label="Nome" requiredMark autoComplete="name" error={errors.name?.message} {...form.register('name')} />
          <FormField id={`${id}-email`} label="E-mail" requiredMark type="email" autoComplete="email" error={errors.email?.message} {...form.register('email')} />
        </div>
        <FormAlert message={errors.root?.server?.message} />
        <button type="submit" disabled={!isDirty || update.isPending} className={`${primaryButtonClass} self-start px-8`}>
          {update.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
          Salvar dados
        </button>
      </form>
    </section>
  )
}

// ——— Senha ———

const PasswordFormSchema = z
  .object({ current: z.string().min(1, 'Informe a senha atual'), next: PasswordSchema, confirm: z.string() })
  .superRefine((v, ctx) => {
    if (v.next === v.current && v.current) ctx.addIssue({ code: 'custom', path: ['next'], message: 'A nova senha deve ser diferente da atual' })
    if (v.confirm !== v.next) ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'As senhas não coincidem' })
  })
type PasswordFormValues = z.infer<typeof PasswordFormSchema>

function PasswordForm() {
  const id = useId()
  const change = useChangePassword()
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { current: '', next: '', confirm: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async ({ current, next }) => {
    try {
      await change.mutateAsync({ current, next })
      form.reset()
      notify.success('Senha alterada. Suas outras sessões foram encerradas.')
    } catch (error) {
      applyServerError(form, error, ['current', 'next'])
    }
  })

  return (
    <section aria-labelledby={`${id}-title`} className={block}>
      <h2 id={`${id}-title`} className={blockTitle}>
        Alterar senha
      </h2>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        <FormField
          id={`${id}-current`}
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          error={errors.current?.message}
          {...form.register('current')}
        />
        <div className="flex flex-col gap-5">
          <FormField
            id={`${id}-next`}
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            hint="8 a 72 caracteres, com letra e número."
            error={errors.next?.message}
            {...form.register('next')}
          />
          <FormField
            id={`${id}-confirm`}
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...form.register('confirm')}
          />
        </div>
        <FormAlert message={errors.root?.server?.message} />
        <button type="submit" disabled={change.isPending} className={`${primaryButtonClass} mt-2 self-start px-8`}>
          {change.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
          Alterar senha
        </button>
      </form>
    </section>
  )
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-x-7 gap-y-6 lg:grid-cols-2" role="status" aria-busy="true" aria-label="Carregando perfil">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="shimmer h-5 w-32 rounded-sm" />
          <div className="shimmer h-10 w-full rounded-[2px]" />
        </div>
      ))}
    </div>
  )
}
