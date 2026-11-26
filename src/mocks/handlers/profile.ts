import { HttpResponse } from 'msw'
import {
  AvatarInputSchema,
  ChangePasswordInputSchema,
  CreateWalletInputSchema,
  UpdateProfileInputSchema,
  UpdateWalletInputSchema,
  type Profile,
  type Wallet,
} from '@/contracts'
import { db, nextId } from '@/mocks/db'
import { hashPassword, randomHex, verifyPassword } from '@/mocks/lib/crypto'
import { normalizeEmail, toUser } from './auth'
import { fail, noContent, parseBody, requireUser, route } from './utils'

const walletsOf = (userId: string) => (db().wallets[userId] ??= [])

export const profileHandlers = [
  route('get', '/profile', ({ request }) => HttpResponse.json<Profile>(toUser(requireUser(request).user))),

  route('patch', '/profile', async ({ request }) => {
    const { user } = requireUser(request)
    const input = await parseBody(request, UpdateProfileInputSchema)
    if (input.email !== undefined) {
      const email = normalizeEmail(input.email)
      if (db().users.some((u) => u.email === email && u.id !== user.id)) {
        fail('CONFLICT', 'Este e-mail já está em uso.', { fields: { email: 'Este e-mail já está em uso.' } })
      }
      user.email = email
    }
    if (input.name !== undefined) user.name = input.name
    return HttpResponse.json<Profile>(toUser(user))
  }),

  route('put', '/profile/avatar', async ({ request }) => {
    const { user } = requireUser(request)
    const input = await parseBody(request, AvatarInputSchema)
    user.avatarUrl = input.dataUrl
    return HttpResponse.json<Profile>(toUser(user))
  }),

  route('post', '/profile/password', async ({ request }) => {
    const { user, token } = requireUser(request)
    const input = await parseBody(request, ChangePasswordInputSchema)
    if (!(await verifyPassword(input.current, user.salt, user.passwordHash))) {
      fail('VALIDATION_ERROR', 'Senha atual incorreta.', { fields: { current: 'Senha atual incorreta.' } })
    }
    user.salt = randomHex(16)
    user.passwordHash = await hashPassword(input.next, user.salt)
    // Encerra as outras sessões do usuário; mantém a atual.
    db().sessions = db().sessions.filter((s) => s.userId !== user.id || s.token === token)
    return noContent()
  }),
]

export const walletHandlers = [
  route('get', '/wallets', ({ request }) => HttpResponse.json<Wallet[]>(walletsOf(requireUser(request).user.id))),

  route('post', '/wallets', async ({ request }) => {
    const { user } = requireUser(request)
    const input = await parseBody(request, CreateWalletInputSchema)
    const list = walletsOf(user.id)
    if (list.some((w) => w.address.toLowerCase() === input.address.toLowerCase() && w.network === input.network)) {
      fail('CONFLICT', 'Esta carteira já está cadastrada.', { fields: { address: 'Carteira já cadastrada nesta rede.' } })
    }
    const primary = list.length === 0 || input.primary === true
    if (primary) for (const w of list) w.primary = false
    const wallet: Wallet = { id: nextId('wal'), label: input.label, address: input.address, network: input.network, primary }
    list.push(wallet)
    return HttpResponse.json<Wallet>(wallet, { status: 201 })
  }),

  route('patch', '/wallets/:id', async ({ request, params }) => {
    const { user } = requireUser(request)
    const input = await parseBody(request, UpdateWalletInputSchema)
    const list = walletsOf(user.id)
    const wallet = list.find((w) => w.id === params.id)
    if (!wallet) fail('NOT_FOUND', 'Carteira não encontrada.')
    if (input.label !== undefined) wallet.label = input.label
    if (input.primary) for (const w of list) w.primary = w.id === wallet.id
    return HttpResponse.json<Wallet>(wallet)
  }),
]
