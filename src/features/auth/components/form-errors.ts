import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { ApiRequestError } from '@/lib/http'

const messages: Partial<Record<string, string>> = {
  NETWORK_ERROR: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
  TIMEOUT: 'O servidor demorou para responder. Tente de novo.',
}

/**
 * Leva o erro da API para o formulário: `fields` do contrato viram erro no campo (com foco no primeiro);
 * o resto vira erro geral (`root.server`, exibido com role="alert").
 */
export function applyServerError<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
  fieldNames: readonly Path<T>[],
) {
  if (error instanceof ApiRequestError) {
    const fields = Object.entries(error.fields ?? {}).filter(([name]) => fieldNames.includes(name as Path<T>))
    fields.forEach(([name, message], i) => form.setError(name as Path<T>, { message }, { shouldFocus: i === 0 }))
    if (fields.length > 0) return
    form.setError('root.server', { message: messages[error.code] ?? error.message })
    return
  }
  form.setError('root.server', { message: 'Algo deu errado. Tente de novo.' })
}
