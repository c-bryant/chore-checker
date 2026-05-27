import { createMiddleware } from '@tanstack/react-start'
import { getUser } from '../lib/netlify-identity.js'
import type { User } from '../lib/netlify-identity.js'
import { remoteIdentityUrl } from '../lib/netlify-identity-config.js'

const NF_JWT_COOKIE = 'nf_jwt'

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64').toString('utf-8')
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const json = decodeBase64Url(parts[1])
    const payload = JSON.parse(json)
    return typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : null
  } catch {
    return null
  }
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [rawName, ...valueParts] = part.trim().split('=')
    if (rawName !== name) continue

    const rawValue = valueParts.join('=')
    if (!rawValue) return null

    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }

  return null
}

function toIdentityUser(user: any): User {
  const userMetadata = user?.user_metadata ?? {}
  const appMetadata = user?.app_metadata ?? {}
  const name = userMetadata.full_name ?? userMetadata.name
  const pictureUrl = userMetadata.avatar_url
  const rolesFromArray = Array.isArray(appMetadata.roles)
    ? appMetadata.roles.filter((role: unknown) => typeof role === 'string')
    : []
  const roleFromUser = typeof user?.role === 'string' ? user.role : null
  const roleFromAppMetadata = typeof appMetadata?.role === 'string' ? appMetadata.role : null
  const roleFromUserMetadata = typeof userMetadata?.role === 'string' ? userMetadata.role : null
  const normalizedRoles = Array.from(new Set([...rolesFromArray, roleFromUser, roleFromAppMetadata, roleFromUserMetadata].filter((value): value is string => Boolean(value))))

  return {
    id: user?.id,
    email: user?.email,
    confirmedAt: typeof user?.confirmed_at === 'string' ? user.confirmed_at : undefined,
    createdAt: user?.created_at,
    updatedAt: user?.updated_at,
    role: typeof user?.role === 'string' ? user.role : undefined,
    provider: typeof appMetadata?.provider === 'string' ? appMetadata.provider : undefined,
    name: typeof name === 'string' ? name : undefined,
    pictureUrl: typeof pictureUrl === 'string' ? pictureUrl : undefined,
    roles: normalizedRoles.length > 0 ? normalizedRoles : undefined,
    userMetadata,
    appMetadata,
  } as User
}

async function fetchRemoteUserFromJwt(jwt: string) {
  if (!remoteIdentityUrl) return null

  const response = await fetch(`${remoteIdentityUrl}/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  })

  if (!response.ok) return null

  const user = await response.json()
  return toIdentityUser(user)
}

function userFromJwt(jwt: string): User | null {
  const payload = parseJwtPayload(jwt)
  if (!payload) return null

  const appMetadata = (typeof payload.app_metadata === 'object' && payload.app_metadata !== null)
    ? payload.app_metadata as Record<string, unknown>
    : {}
  const userMetadata = (typeof payload.user_metadata === 'object' && payload.user_metadata !== null)
    ? payload.user_metadata as Record<string, unknown>
    : {}

  const sub = typeof payload.sub === 'string' ? payload.sub : undefined
  const email = typeof payload.email === 'string' ? payload.email : undefined
  const role = typeof payload.role === 'string' ? payload.role : undefined
  const rolesFromJwt = Array.isArray((appMetadata as any).roles)
    ? ((appMetadata as any).roles as unknown[]).filter((value): value is string => typeof value === 'string')
    : []
  const roleFromMetadata = typeof userMetadata.role === 'string' ? userMetadata.role : undefined
  const normalizedRoles = Array.from(new Set([...rolesFromJwt, role, roleFromMetadata].filter((value): value is string => Boolean(value))))

  if (!sub && !email) return null

  return {
    id: sub ?? email,
    email,
    role,
    roles: normalizedRoles.length > 0 ? normalizedRoles : undefined,
    userMetadata,
    appMetadata,
    provider: typeof appMetadata.provider === 'string' ? appMetadata.provider : undefined,
  } as User
}

export async function resolveServerUser(request: Request): Promise<User | null> {
  let user: User | null = null
  try {
    user = (await getUser()) as User | null
  } catch {
    user = null
  }

  if (user) return user

  const jwt = readCookie(request, NF_JWT_COOKIE)
  if (!jwt) return null

  const jwtUser = userFromJwt(jwt)
  if (jwtUser) return jwtUser

  try {
    return await fetchRemoteUserFromJwt(jwt)
  } catch {
    return null
  }
}

export const identityMiddleware = createMiddleware().server(async ({ next, request }) => {
  const user: User | null = await resolveServerUser(request)
  return next({ context: { user } })
})

export const requireAuthMiddleware = createMiddleware().server(async ({ next, request }) => {
  const user = await resolveServerUser(request)
  if (!user) throw new Response('Authentication required', { status: 401 })
  return next({ context: { user } })
})

export function requireRoleMiddleware(role: string) {
  return createMiddleware().server(async ({ next, request }) => {
    const user = await resolveServerUser(request)
    if (!user) throw new Response('Authentication required', { status: 401 })
    const metadataRole = typeof user.userMetadata?.role === 'string' ? user.userMetadata.role : undefined
    const hasRole = user.roles?.includes(role) || user.role === role || metadataRole === role
    if (!hasRole) throw new Response(`Role '${role}' required`, { status: 403 })
    return next({ context: { user } })
  })
}
