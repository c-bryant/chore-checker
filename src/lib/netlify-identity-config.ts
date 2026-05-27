type NetlifyIdentityContext = {
  url: string
  token?: string
}

declare global {
  var netlifyIdentityContext: NetlifyIdentityContext | undefined
}

const remoteSiteUrl = import.meta.env.VITE_NETLIFY_SITE_URL?.trim() ?? ''

function getRemoteIdentityUrl() {
  if (!remoteSiteUrl) return ''

  try {
    return new URL('/.netlify/identity', remoteSiteUrl).href
  } catch {
    console.warn('Ignoring invalid VITE_NETLIFY_SITE_URL value.')
    return ''
  }
}

export const remoteIdentityUrl = getRemoteIdentityUrl()

export const hasRemoteIdentityUrl = Boolean(remoteIdentityUrl)

function isLocalBrowser() {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

export const browserIdentityUrl = hasRemoteIdentityUrl && isLocalBrowser()
  ? new URL('/.netlify/identity', window.location.origin).href
  : remoteIdentityUrl

if (remoteIdentityUrl) {
  if (typeof window === 'undefined') {
    process.env.URL ??= remoteSiteUrl
  } else {
    globalThis.netlifyIdentityContext = {
      ...globalThis.netlifyIdentityContext,
      url: browserIdentityUrl,
    }
  }
}
