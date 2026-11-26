import { ProfileSchema } from '@/contracts'
import { request } from '@/lib/http'

export const fetchProfile = (signal?: AbortSignal) => request(ProfileSchema, { url: '/profile', signal })
