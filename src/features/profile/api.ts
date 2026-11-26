import { ProfileSchema, type AvatarInput, type ChangePasswordInput, type UpdateProfileInput } from '@/contracts'
import { request, requestVoid } from '@/lib/http'

export const fetchProfile = (signal?: AbortSignal) => request(ProfileSchema, { url: '/profile', signal })

export const updateProfile = (input: UpdateProfileInput) =>
  request(ProfileSchema, { method: 'patch', url: '/profile', data: input })

export const uploadAvatar = (input: AvatarInput) =>
  request(ProfileSchema, { method: 'put', url: '/profile/avatar', data: input })

export const changePassword = (input: ChangePasswordInput) =>
  requestVoid({ method: 'post', url: '/profile/password', data: input })
