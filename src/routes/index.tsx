import { createFileRoute, redirect } from '@tanstack/react-router'
import { getServerUser } from '../lib/auth'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await getServerUser()
    if (user) throw redirect({ to: '/dashboard' })
    throw redirect({ to: '/login' })
  },
})
