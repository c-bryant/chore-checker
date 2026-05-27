import type { Handler } from '@netlify/functions'
import { db } from '../../db/index.js'
import { chores } from '../../db/schema.js'

const handler: Handler = async (event) => {
  const user = JSON.parse(event.body || '{}')

  // Count existing chores as a proxy for whether parent exists.
  // Assign 'parent' to first registered user, 'kid' to all others.
  // The parent can also manually update roles in the Netlify dashboard.
  let role = 'kid'
  try {
    const existingChores = await db.select().from(chores).limit(1)
    // A simpler heuristic: check if user metadata says they are a parent
    const isParent = user?.user_metadata?.role === 'parent'
    if (isParent) {
      role = 'parent'
    }
  } catch {
    // DB not ready, default to kid
  }

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
