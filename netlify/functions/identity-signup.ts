import type { Handler } from '@netlify/functions'

const handler: Handler = async (event) => {
  let user: any = {}
  try {
    user = event.body ? JSON.parse(event.body) : {}
  } catch {
    user = {}
  }

  // The role selected during signup is stored in user_metadata.
  // Roles can also be changed manually in the Netlify dashboard.
  const role = user?.user_metadata?.role === 'parent' ? 'parent' : 'kid'

  return {
    statusCode: 200,
    body: JSON.stringify({
      app_metadata: {
        roles: [role],
      },
    }),
  }
}

export { handler }
