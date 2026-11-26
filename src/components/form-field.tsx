import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-10 w-full rounded-md border border-border-soft bg-surface-dark px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-coral disabled:opacity-60'

type FormFieldProps = ComponentProps<'input'> & { id: string; label: string; error?: string; hint?: ReactNode }

/**
 * Campo com label visível (checkout, perfil, carteiras). Erro em coral ligado por `aria-describedby`
 * (junto com a dica, se houver) e `aria-invalid`.
 */
export function FormField({ id, label, error, hint, className, ...props }: FormFieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
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
  'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'

export const outlineButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-primary px-4 text-sm font-bold text-brand outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60'
