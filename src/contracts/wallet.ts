import { z } from 'zod'
import { IdSchema } from './common'

export const NETWORKS = ['ethereum', 'polygon', 'base'] as const
export const NetworkSchema = z.enum(NETWORKS)
export type Network = z.infer<typeof NetworkSchema>

export const WalletAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço inválido (0x + 40 hex)')

export const WalletSchema = z.object({
  id: IdSchema,
  label: z.string(),
  address: WalletAddressSchema,
  network: NetworkSchema,
  primary: z.boolean(),
})
export type Wallet = z.infer<typeof WalletSchema>

export const WalletListSchema = z.array(WalletSchema)

const LabelSchema = z.string().trim().min(1, 'Informe um nome').max(40, 'Máximo de 40 caracteres')

export const CreateWalletInputSchema = z.object({
  label: LabelSchema,
  address: WalletAddressSchema,
  network: NetworkSchema,
  primary: z.boolean().optional(),
})
export type CreateWalletInput = z.infer<typeof CreateWalletInputSchema>

/** `primary` só aceita `true`: tornar outra carteira primária é a única forma de trocar (sempre exatamente uma). */
export const UpdateWalletInputSchema = z
  .object({ label: LabelSchema.optional(), primary: z.literal(true).optional() })
  .refine((v) => v.label !== undefined || v.primary !== undefined, 'Nada para atualizar')
export type UpdateWalletInput = z.infer<typeof UpdateWalletInputSchema>
