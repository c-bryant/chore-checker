import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { chores, weeklySchedule, choreCompletions } from '../../db/schema.js'
import { requireAuthMiddleware, requireRoleMiddleware } from '../middleware/identity.js'

function extractDbError(err: unknown): string {
  if (!(err instanceof Error)) return 'Unknown database error'

  const base = err.message
  const cause = err.cause
  if (!cause || typeof cause !== 'object') return base

  const causeMessage = 'message' in cause && typeof cause.message === 'string' ? cause.message : ''
  const detail = 'detail' in cause && typeof cause.detail === 'string' ? cause.detail : ''
  const code = 'code' in cause && typeof cause.code === 'string' ? cause.code : ''

  return [base, causeMessage, detail, code ? `(code: ${code})` : ''].filter(Boolean).join(' | ')
}

let schemaInitPromise: Promise<void> | null = null

async function ensureSchema() {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      await db.execute(sql`
        create table if not exists chores (
          id serial primary key,
          title text not null,
          description text default '' not null,
          emoji text default '✅' not null,
          created_by text not null,
          created_at timestamp default now() not null
        )
      `)

      await db.execute(sql`
        create table if not exists weekly_schedule (
          id serial primary key,
          chore_id integer not null references chores(id) on delete cascade,
          day_of_week integer not null,
          assigned_to text default 'all' not null,
          created_at timestamp default now() not null
        )
      `)

      await db.execute(sql`
        create table if not exists chore_completions (
          id serial primary key,
          schedule_id integer not null references weekly_schedule(id) on delete cascade,
          completed_by text not null,
          week_start_date date not null,
          completed_at timestamp default now() not null
        )
      `)
    })()
  }

  return schemaInitPromise
}

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
    await ensureSchema()
    return db.select().from(chores).orderBy(chores.createdAt)
  })

export const createChore = createServerFn({ method: 'POST' })
  .middleware([requireRoleMiddleware('parent')])
  .inputValidator(
    (data: { title: string; description?: string; emoji?: string }) => data
  )
  .handler(async ({ data, context }) => {
    await ensureSchema()
    const title = data.title.trim()
    const description = data.description?.trim() ?? ''
    const actorId = context.user.id || context.user.email || 'unknown-user'
    try {
      await db
        .insert(chores)
        .values({
          title,
          description,
          emoji: data.emoji ?? '✅',
          createdBy: actorId,
        })

      return { success: true }
    } catch (err: unknown) {
      const message = extractDbError(err)
      throw new Error(`Failed to create chore: ${message}`)
    }
  })

export const deleteChore = createServerFn({ method: 'POST' })
  .middleware([requireRoleMiddleware('parent')])
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await ensureSchema()
    await db.delete(chores).where(eq(chores.id, data.id))
    return { success: true }
  })

export const updateChore = createServerFn({ method: 'POST' })
  .middleware([requireRoleMiddleware('parent')])
  .inputValidator(
    (data: { id: number; title: string; description?: string; emoji?: string }) => data
  )
  .handler(async ({ data }) => {
    await ensureSchema()
    const title = data.title.trim()
    const description = data.description?.trim() ?? ''

    await db
      .update(chores)
      .set({
        title,
        description,
        emoji: data.emoji ?? '✅',
      })
      .where(eq(chores.id, data.id))

    return { success: true }
  })

export const getWeeklySchedule = createServerFn({ method: 'GET' })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    await ensureSchema()
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
    await ensureSchema()
    await db
      .insert(weeklySchedule)
      .values({
        choreId: data.choreId,
        dayOfWeek: data.dayOfWeek,
        assignedTo: data.assignedTo ?? 'all',
      })

    return { success: true }
  })

export const removeFromSchedule = createServerFn({ method: 'POST' })
  .middleware([requireRoleMiddleware('parent')])
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await ensureSchema()
    await db.delete(weeklySchedule).where(eq(weeklySchedule.id, data.id))
    return { success: true }
  })

export const getCompletions = createServerFn({ method: 'GET' })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    await ensureSchema()
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
    await ensureSchema()
    const actorId = context.user.id || context.user.email || 'unknown-user'
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
      completedBy: actorId,
      weekStartDate: weekStart,
    })
    return { completed: true }
  })
