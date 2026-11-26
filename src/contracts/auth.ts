import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './common'

export const EmailSchema = z.email('Informe um e-mail válido')

export const PasswordSchema = z
  .string()
  .min(8, 'A senha precisa ter ao menos 8 caracteres')
  .max(72, 'A senha pode ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')

export const UserSchema = z.object({
  id: IdSchema,
  name: z.string(),
  email: EmailSchema,
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof UserSchema>

export const SessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: IsoDateSchema,
  user: UserSchema,
})
export type Session = z.infer<typeof SessionSchema>

export const NameSchema = z
  .string()
  .trim()
  .min(2, 'Informe ao menos 2 caracteres')
  .max(80, 'Máximo de 80 caracteres')

export const RegisterInputSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: PasswordSchema,
})
export type RegisterInput = z.infer<typeof RegisterInputSchema>

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginInput = z.infer<typeof LoginInputSchema>
