import GoTrue, { type User as GoTrueUser } from 'gotrue-js'
import * as identity from '@netlify/identity'
import { browserIdentityUrl } from './netlify-identity-config'

export * from '@netlify/identity'
export type { User } from '@netlify/identity'

const NF_JWT_COOKIE = 'nf_jwt'
const NF_REFRESH_COOKIE = 'nf_refresh'

type AuthListener = (user: identity.User | null) => void

let remoteClient: GoTrue | null = null
const authListeners = new Set<AuthListener>()

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function shouldUseRemoteBrowserClient() {
  return isBrowser() && Boolean(browserIdentityUrl)
}

function getRemoteClient() {
  remoteClient ??= new GoTrue({ APIUrl: browserIdentityUrl, setCookie: false })
  return remoteClient
}

function toRoles(appMetadata: GoTrueUser['app_metadata']) {
  const roles = appMetadata?.roles
  return Array.isArray(roles) && roles.every((role) => typeof role === 'string') ? roles : undefined
}

function toIdentityUser(user: GoTrueUser): identity.User {
  const userMetadata = user.user_metadata ?? {}
  const appMetadata = user.app_metadata ?? {}
  const name = userMetadata.full_name ?? userMetadata.name
  const pictureUrl = userMetadata.avatar_url

  return {
    id: user.id,
    email: user.email,
    confirmedAt: typeof user.confirmed_at === 'string' ? user.confirmed_at : undefined,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    role: typeof user.role === 'string' ? user.role : undefined,
    provider: typeof appMetadata.provider === 'string' ? appMetadata.provider as identity.AuthProvider : undefined,
    name: typeof name === 'string' ? name : undefined,
    pictureUrl: typeof pictureUrl === 'string' ? pictureUrl : undefined,
    roles: toRoles(appMetadata),
    userMetadata,
    appMetadata,
  } as identity.User
}

function cookieOptions() {
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  return `path=/; samesite=lax${secure}`
}

function setAuthCookies(accessToken: string, refreshToken?: string) {
  document.cookie = `${NF_JWT_COOKIE}=${encodeURIComponent(accessToken)}; ${cookieOptions()}`
  if (refreshToken) {
    document.cookie = `${NF_REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; ${cookieOptions()}`
  }
}

function deleteAuthCookies() {
  const expired = 'path=/; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  document.cookie = `${NF_JWT_COOKIE}=; ${expired}`
  document.cookie = `${NF_REFRESH_COOKIE}=; ${expired}`
  document.cookie = `${NF_JWT_COOKIE}=; ${expired}; secure`
  document.cookie = `${NF_REFRESH_COOKIE}=; ${expired}; secure`
}

function emitAuthChange(user: identity.User | null) {
  authListeners.forEach((listener) => listener(user))
}

function getCookie(name: string) {
  const cookies = document.cookie.split(';').map((part) => part.trim())
  const match = cookies.find((part) => part.startsWith(`${name}=`))
  if (!match) return null
  return decodeURIComponent(match.slice(name.length + 1))
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function fetchIdentityUser(accessToken: string) {
  const response = await fetchWithTimeout(`${browserIdentityUrl}/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch user data (${response.status})`)
  }

  const userData = await response.json()

  return toIdentityUser(userData as GoTrueUser)
}

async function persistUserSession(user: GoTrueUser) {
  const jwt = await user.jwt()
  setAuthCookies(jwt, user.tokenDetails()?.refresh_token)
  const identityUser = toIdentityUser(user)
  emitAuthChange(identityUser)
  return identityUser
}

export async function login(email: string, password: string) {
  if (!shouldUseRemoteBrowserClient()) return identity.login(email, password)

  const response = await fetchWithTimeout(`${browserIdentityUrl}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=password&username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  })

  let data: any = {}
  try {
    data = await response.json()
  } catch {
    data = {}
  }

  if (!response.ok) {
    throw new Error(data?.msg || data?.error_description || `Login failed (${response.status})`)
  }

  const accessToken = data?.access_token as string | undefined
  const refreshToken = data?.refresh_token as string | undefined
  if (!accessToken) {
    throw new Error('Login succeeded but no access token was returned.')
  }

  setAuthCookies(accessToken, refreshToken)
  const user = await fetchIdentityUser(accessToken)
  emitAuthChange(user)
  return user
}

export async function signup(email: string, password: string, data?: identity.SignupData) {
  if (!shouldUseRemoteBrowserClient()) return identity.signup(email, password, data)

  const response = await getRemoteClient().signup(email, password, data)
  return response as unknown as identity.User
}

export async function getUser() {
  if (!shouldUseRemoteBrowserClient()) return identity.getUser()

  const user = getRemoteClient().currentUser()
  if (user) return toIdentityUser(user)

  const accessToken = getCookie(NF_JWT_COOKIE)
  if (!accessToken) return null

  try {
    return await fetchIdentityUser(accessToken)
  } catch {
    deleteAuthCookies()
    return null
  }
}

export async function logout() {
  if (!shouldUseRemoteBrowserClient()) return identity.logout()

  const user = getRemoteClient().currentUser()
  if (user) await user.logout()
  deleteAuthCookies()
  emitAuthChange(null)
}

function clearAuthHash() {
  window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`)
}

export async function handleAuthCallback(): Promise<identity.CallbackResult | null> {
  if (!shouldUseRemoteBrowserClient()) return identity.handleAuthCallback()

  const hash = window.location.hash.substring(1)
  if (!hash) return null

  const params = new URLSearchParams(hash)
  const confirmationToken = params.get('confirmation_token')

  if (confirmationToken) {
    const user = await getRemoteClient().confirm(confirmationToken, true)
    const identityUser = await persistUserSession(user)
    clearAuthHash()
    return { type: 'confirmation', user: identityUser }
  }

  return identity.handleAuthCallback()
}

export function onAuthChange(listener: AuthListener) {
  if (!shouldUseRemoteBrowserClient()) return identity.onAuthChange((_event, user) => listener(user))

  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}
