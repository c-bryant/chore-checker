import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import { IdentityProvider } from '../lib/identity-context'
import { CallbackHandler } from '../components/CallbackHandler'
import { remoteIdentityUrl } from '../lib/netlify-identity-config'

import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Chore Chart' },
    ],
  }),
  notFoundComponent: NotFoundPage,
  shellComponent: RootDocument,
})

function NotFoundPage() {
  return (
    <main className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🏠</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Page not found</h1>
        <p className="text-gray-600 mb-6">This page is not part of the chore chart.</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center bg-amber-400 hover:bg-amber-500 text-white font-semibold px-5 py-3 rounded-lg transition-colors"
        >
          Go home
        </Link>
      </div>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <IdentityEndpointScript />
        <HeadContent />
      </head>
      <body>
        <IdentityProvider>
          <CallbackHandler>{children}</CallbackHandler>
        </IdentityProvider>
        <Scripts />
      </body>
    </html>
  )
}

function IdentityEndpointScript() {
  if (!remoteIdentityUrl) return null

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(()=>{const remote=${JSON.stringify(remoteIdentityUrl)};const host=location.hostname;const local=['localhost','127.0.0.1','::1'].includes(host);globalThis.netlifyIdentityContext={...(globalThis.netlifyIdentityContext||{}),url:local?new URL('/.netlify/identity',location.origin).href:remote};})();`,
      }}
    />
  )
}
