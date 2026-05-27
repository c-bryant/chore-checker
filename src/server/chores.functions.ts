import { createServerFn } from '@tanstack/react-start'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { chores, weeklySchedule, choreCompletions } from '../../db/schema.js'
import { requireAuthMiddleware, requireRoleMiddleware } from '../middleware/identity.js'

// Get Monday of the current week
function getWeekStart(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export const getChores = createServerFn({ method: 'GET' })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    return db.select().from(chores).orderBy(chores.createdAt)
  })

export const createChore = createServerFn({ method: 'POST' })
  .middleware([requireRoleMiddleware('parent')])
  .inputValidator(
    (data: { title: string; description?: string; emoji?: string }) => data
  )
  .handler(async ({ data, context }) => {
    const [chore] = await db
      .insert(chores)
      .values({
        title: data.title,
        description: data.description ?? '',
        emoji: data.emoji ?? '✅',
        createdBy: context.user.id,
      })
      .returning()
    return chore
  })

export const deleteChore = createServerFn({ method: 'POST' })
  .middleware([requireRoleMiddleware('parent')])
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await db.delete(chores).where(eq(chores.id, data.id))
    return { success: true }
  })

export const getWeeklySchedule = createServerFn({ method: 'GET' })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const schedule = await db
      .select({
        id: weeklySchedule.id,
        choreId: weeklySchedule.choreId,
        dayOfWeek: weeklySchedule.dayOfWeek,
        assignedTo: weeklySchedule.assignedTo,
        choreTitle: chores.title,
        choreEmoji: chores.emoji,
        choreDescription: chores.description,
      })
      .from(weeklySchedule)
      .innerJoin(chores, eq(weeklySchedule.choreId, chores.id))
      .orderBy(weeklySchedule.dayOfWeek, chores.title)
    return schedule
  })

export const addToSchedule = createServerFn({ method: 'POST' })
  .middleware([requireRoleMiddleware('parent')])
  .inputValidator(
    (data: { choreId: number; dayOfWeek: number; assignedTo?: string }) => data
  )
  .handler(async ({ data }) => {
    const [entry] = await db
      .insert(weeklySchedule)
      .values({
        choreId: data.choreId,
        dayOfWeek: data.dayOfWeek,
        assignedTo: data.assignedTo ?? 'all',
      })
      .returning()
    return entry
  })

export const removeFromSchedule = createServerFn({ method: 'POST' })
  .middleware([requireRoleMiddleware('parent')])
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await db.delete(weeklySchedule).where(eq(weeklySchedule.id, data.id))
    return { success: true }
  })

export const getCompletions = createServerFn({ method: 'GET' })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const weekStart = getWeekStart()
    return db
      .select()
      .from(choreCompletions)
      .where(eq(choreCompletions.weekStartDate, weekStart))
  })

export const markComplete = createServerFn({ method: 'POST' })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { scheduleId: number }) => data)
  .handler(async ({ data, context }) => {
    const weekStart = getWeekStart()
    // Check if already completed
    const existing = await db
      .select()
      .from(choreCompletions)
      .where(
        and(
          eq(choreCompletions.scheduleId, data.scheduleId),
          eq(choreCompletions.weekStartDate, weekStart)
        )
      )
    if (existing.length > 0) {
      // Toggle off (undo)
      await db
        .delete(choreCompletions)
        .where(
          and(
            eq(choreCompletions.scheduleId, data.scheduleId),
            eq(choreCompletions.weekStartDate, weekStart)
          )
        )
      return { completed: false }
    }
    await db.insert(choreCompletions).values({
      scheduleId: data.scheduleId,
      completedBy: context.user.id,
      weekStartDate: weekStart,
    })
    return { completed: true }
  })
