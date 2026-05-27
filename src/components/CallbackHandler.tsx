import { useEffect, useState } from 'react'
import { handleAuthCallback } from '../lib/netlify-identity'

const AUTH_HASH_PATTERN =
  /^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/

export function CallbackHandler({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('')

  function clearAuthHash() {
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`)
  }

  useEffect(() => {
    if (AUTH_HASH_PATTERN.test(window.location.hash)) {
      handleAuthCallback()
        .then((result) => {
          if (result?.type === 'confirmation') {
            // setMessage('Email confirmed. Redirecting...')
          }
        })
        .catch((err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : 'The email confirmation link could not be processed.'
          setMessage(errorMessage)
        })
        .finally(() => {
          clearAuthHash()
        })
    }
  }, [])

  return (
    <>
      {message && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-xl bg-white px-4 py-3 text-sm text-gray-700 shadow-lg ring-1 ring-gray-200">
          {message}
        </div>
      )}
      {children}
    </>
  )
}
