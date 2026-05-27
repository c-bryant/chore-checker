import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  date,
} from 'drizzle-orm/pg-core'

export const chores = pgTable('chores', {
  id: serial().primaryKey(),
  title: text().notNull(),
  description: text().notNull().default(''),
  emoji: text().notNull().default('✅'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const weeklySchedule = pgTable('weekly_schedule', {
  id: serial().primaryKey(),
  choreId: integer('chore_id')
    .notNull()
    .references(() => chores.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0=Sunday, 1=Monday, ... 6=Saturday
  assignedTo: text('assigned_to').notNull().default('all'), // 'all', 'parent', or 'kid'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const choreCompletions = pgTable('chore_completions', {
  id: serial().primaryKey(),
  scheduleId: integer('schedule_id')
    .notNull()
    .references(() => weeklySchedule.id, { onDelete: 'cascade' }),
  completedBy: text('completed_by').notNull(),
  weekStartDate: date('week_start_date').notNull(),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
})
