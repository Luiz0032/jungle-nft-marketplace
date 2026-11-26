import { HttpResponse } from 'msw'
import { nanoid } from 'nanoid'
import { LoginInputSchema, RegisterInputSchema, type Session, type User } from '@/contracts'
import { db, nextId } from '@/mocks/db'
import type { UserRecord } from '@/mocks/db'
import { hashPassword, randomHex, verifyPassword } from '@/mocks/lib/crypto'
import { fail, noContent, parseBody, requireUser, route } from './utils'

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000

export const toUser = (u: UserRecord): User => ({ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl })

function createSession(user: UserRecord): Session {
  const token = nanoid(32)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  db().sessions.push({ token, userId: user.id, expiresAt })
  return { token, expiresAt, user: toUser(user) }
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const authHandlers = [
  route('post', '/auth/register', async ({ request }) => {
    const input = await parseBody(request, RegisterInputSchema)
    const email = normalizeEmail(input.email)
    if (db().users.some((u) => u.email === email)) {
      fail('CONFLICT', 'Este e-mail já está cadastrado.', { fields: { email: 'Este e-mail já está cadastrado.' } })
    }
    const salt = randomHex(16)
    const user: UserRecord = {
      id: nextId('usr'),
      name: input.name,
      email,
      avatarUrl: null,
      salt,
      passwordHash: await hashPassword(input.password, salt),
    }
    db().users.push(user)
    db().wallets[user.id] = []
    return HttpResponse.json(createSession(user), { status: 201 })
  }),

  route('post', '/auth/login', async ({ request }) => {
    const input = await parseBody(request, LoginInputSchema)
    const user = db().users.find((u) => u.email === normalizeEmail(input.email))
    if (!user || !(await verifyPassword(input.password, user.salt, user.passwordHash))) {
      fail('UNAUTHENTICATED', 'E-mail ou senha inválidos.')
    }
    return HttpResponse.json(createSession(user))
  }),

  route('get', '/auth/session', ({ request }) => {
    const { user, token } = requireUser(request)
    const session = db().sessions.find((s) => s.token === token)!
    return HttpResponse.json<Session>({ token, expiresAt: session.expiresAt, user: toUser(user) })
  }),

  route('post', '/auth/logout', ({ request }) => {
    const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1]
    if (token) db().sessions = db().sessions.filter((s) => s.token !== token)
    return noContent()
  }),
]
