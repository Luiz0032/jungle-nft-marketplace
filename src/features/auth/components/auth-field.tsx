import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type AuthFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  id: string
  label: string
  error?: string
  /** Botão de mostrar/ocultar (campos de senha). */
  revealable?: boolean
}

/**
 * Input dos formulários de auth — Figma "Email Input"/"Password Input" (70381:242/243, mobile 70410:4221).
 * Desktop 40px/raio 5; mobile 50px/raio 10. O Figma usa só placeholder: o label existe e está associado,
 * mas fica visualmente oculto. Erro: borda coral + mensagem ligada por `aria-describedby`.
 */
export function AuthField({ id, label, error, revealable, type, className, ...props }: AuthFieldProps) {
  const [visible, setVisible] = useState(false)
  const errorId = `${id}-error`

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={revealable && visible ? 'text' : type}
          placeholder={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-[50px] w-full rounded-[10px] border border-border bg-transparent px-4 text-sm leading-4 text-foreground outline-none placeholder:text-subtle',
            'focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary',
            'aria-invalid:border-coral aria-invalid:focus-visible:ring-coral',
            'lg:h-10 lg:rounded-[5px]',
            revealable && 'pr-11',
          )}
          {...props}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            aria-controls={id}
            className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-sm text-subtle outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {visible ? <Eye className="size-[18px]" aria-hidden /> : <EyeOff className="size-[18px]" aria-hidden />}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-xs leading-4 text-coral">
          {error}
        </p>
      )}
    </div>
  )
}
