import { z } from 'zod'
import { EmailSchema, NameSchema, PasswordSchema, UserSchema } from './auth'

export const ProfileSchema = UserSchema
export type Profile = z.infer<typeof ProfileSchema>

export const UpdateProfileInputSchema = z
  .object({ name: NameSchema.optional(), email: EmailSchema.optional() })
  .refine((v) => v.name !== undefined || v.email !== undefined, 'Nada para atualizar')
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>

export const AVATAR_MAX_BYTES = 1024 * 1024
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Tamanho decodificado (bytes) de um data URL base64. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

export const AvatarInputSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/, 'Use uma imagem PNG, JPEG ou WebP')
    .refine((v) => dataUrlBytes(v) <= AVATAR_MAX_BYTES, 'A imagem deve ter no máximo 1 MB'),
})
export type AvatarInput = z.infer<typeof AvatarInputSchema>

export const ChangePasswordInputSchema = z
  .object({ current: z.string().min(1, 'Informe a senha atual'), next: PasswordSchema })
  .refine((v) => v.current !== v.next, { message: 'A nova senha deve ser diferente da atual', path: ['next'] })
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>
