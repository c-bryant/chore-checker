import { createServerFn } from '@tanstack/react-start'
import type { User } from './netlify-identity.js'
import { identityMiddleware } from '../middleware/identity.js'

export type { User as IdentityUser }
export const getServerUser = createServerFn({ method: 'GET' })
  .middleware([identityMiddleware])
  .handler(async ({ context }) => {
    const user = (context.user ?? null) as User | null
    return (user ?? null) as any
  })
