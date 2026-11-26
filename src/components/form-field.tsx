import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Figma (Perfil 9:1238, Pagamento 11:2862): campo de 40px transparente, borda fina marrom, raio 2. */
export const inputClass =
  'h-10 w-full rounded-[2px] border border-border-soft bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-coral disabled:opacity-60'

export const labelClass = 'text-[15px] leading-5 text-foreground'

/** Asterisco coral dos campos obrigatórios (decorativo: o campo já tem `required`/validação). */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-[15px] leading-5 text-coral">
      *
    </span>
  )
}

type FormFieldProps = ComponentProps<'input'> & {
  id: string
  label: string
  error?: string
  hint?: ReactNode
  /** Mostra o asterisco do Figma. */
  requiredMark?: boolean
}

/**
 * Campo com label visível (checkout, perfil, carteiras). Erro em coral ligado por `aria-describedby`
 * (junto com a dica, se houver) e `aria-invalid`.
 */
export function FormField({ id, label, error, hint, requiredMark, className, ...props }: FormFieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {requiredMark && <RequiredMark />}
      </div>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-coral">
          {error}
        </p>
      )}
    </div>
  )
}

/** Mensagem de erro geral de formulário (erro do servidor sem campo). */
export function FormAlert({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-coral">
      {message}
    </p>
  )
}

export const primaryButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-[2px] bg-primary px-5 text-sm font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'

export const outlineButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-[2px] border border-primary px-4 text-sm font-bold text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Opção de rádio em linha (Figma "Carteira e rede"): cartão arredondado de 64px no mobile (16:748) e caixa com
 * borda de 45px no desktop (11:2862). A borda do desktop vem de `radioRowOn`/`radioRowOff`.
 */
export const radioRowClass =
  'flex min-h-16 cursor-pointer items-center gap-3 rounded-[10px] border border-transparent bg-surface px-4 py-2.5 text-[15px] outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring lg:min-h-[45px] lg:rounded-none lg:bg-transparent'

export const radioRowOn = 'lg:border-foreground'
export const radioRowOff = 'lg:border-border-soft'

export function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden="true" className="grid size-[18px] shrink-0 place-items-center rounded-full border-2 border-primary">
      {checked && <span className="size-2 rounded-full bg-primary" />}
    </span>
  )
}
