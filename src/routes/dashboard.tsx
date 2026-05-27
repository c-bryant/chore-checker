import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useIdentity } from '../lib/identity-context'
import { getServerUser } from '../lib/auth'
import {
  getWeeklySchedule,
  getCompletions,
  markComplete,
  getChores,
  createChore,
  updateChore,
  deleteChore,
  addToSchedule,
  removeFromSchedule,
} from '../server/chores.functions'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const user = await getServerUser()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: DashboardPage,
})

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const EMOJIS = ['✅', '🧹', '🍽️', '🛏️', '🐕', '🌿', '🗑️', '🧺', '🧼', '📚', '🚿', '🪣']

function getWeekDates(anchorDate = new Date()) {
  const day = anchorDate.getDay()
  const monday = new Date(anchorDate)
  monday.setDate(anchorDate.getDate() - day + (day === 0 ? -6 : 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function todayDayOfWeek() {
  return new Date().getDay()
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getMonthGridDates(anchorDate = new Date()) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - monthStart.getDay())

  const dates: Date[] = []
  const cursor = new Date(gridStart)

  while (dates.length < 42) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  if (dates[41] < monthEnd) {
    while (dates.length < 49) {
      dates.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return dates
}

type ScheduleEntry = {
  id: number
  choreId: number
  dayOfWeek: number
  assignedTo: string
  choreTitle: string
  choreEmoji: string
  choreDescription: string
}

type Completion = {
  id: number
  scheduleId: number
  completedBy: string
  weekStartDate: string
  completedAt: string
}

type Chore = {
  id: number
  title: string
  description: string
  emoji: string
  createdBy: string
}

function DashboardPage() {
  const { user, ready, logout } = useIdentity()
  const navigate = useNavigate()
  const isParent = user?.roles?.includes('parent') || user?.role === 'parent' || user?.userMetadata?.role === 'parent'

  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [choresList, setChoresList] = useState<Chore[]>([])
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'week' | 'manage'>('week')
  const [scheduleLayout, setScheduleLayout] = useState<'daily' | 'week-calendar' | 'month-calendar'>('daily')
  const [calendarWeekDate, setCalendarWeekDate] = useState(() => new Date())
  const [calendarMonthDate, setCalendarMonthDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // New chore form
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newEmoji, setNewEmoji] = useState('✅')
  const [addingChore, setAddingChore] = useState(false)

  // Edit chore form
  const [editingChoreId, setEditingChoreId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editEmoji, setEditEmoji] = useState('✅')
  const [savingEdit, setSavingEdit] = useState(false)

  // Add to schedule form
  const [scheduleChoreId, setScheduleChoreId] = useState<number | ''>('')
  const [scheduleDay, setScheduleDay] = useState<number>(1)
  const [scheduleAssign, setScheduleAssign] = useState<string>('all')
  const [addingSchedule, setAddingSchedule] = useState(false)

  const weekDates = getWeekDates(calendarWeekDate)
  const currentWeekDates = getWeekDates(new Date())
  const todayDow = todayDayOfWeek()
  const today = new Date()
  const monthGridDates = getMonthGridDates(calendarMonthDate)
  const activeMonth = calendarMonthDate.getMonth()
  const weekDateKeys = new Set(weekDates.map((date) => toDateKey(date)))
  const isCurrentWeekView = toDateKey(weekDates[0]) === toDateKey(currentWeekDates[0])

  function goToPreviousWeek() {
    setCalendarWeekDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() - 7)
      return next
    })
  }

  function goToNextWeek() {
    setCalendarWeekDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + 7)
      return next
    })
  }

  function goToCurrentWeek() {
    setCalendarWeekDate(new Date())
  }

  function goToPreviousMonth() {
    setCalendarMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  function goToNextMonth() {
    setCalendarMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  function goToCurrentMonth() {
    const now = new Date()
    setCalendarMonthDate(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  useEffect(() => {
    if (!ready) return
    if (!user) { navigate({ to: '/login' }); return }
    loadData()
  }, [ready, user])

  async function loadData() {
    setLoading(true)
    try {
      const [sched, comps, chrs] = await Promise.all([
        getWeeklySchedule(),
        getCompletions(),
        getChores(),
      ])
      setSchedule(Array.isArray(sched) ? (sched as ScheduleEntry[]) : [])
      setCompletions(Array.isArray(comps) ? (comps as Completion[]) : [])
      setChoresList(Array.isArray(chrs) ? (chrs as Chore[]) : [])
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkComplete(scheduleId: number) {
    await markComplete({ data: { scheduleId } })
    const comps = await getCompletions()
    setCompletions(comps as Completion[])
  }

  async function handleCreateChore() {
    if (!newTitle.trim()) return
    setActionError('')
    setAddingChore(true)
    try {
      await createChore({ data: { title: newTitle.trim(), description: newDesc.trim(), emoji: newEmoji } })
      setNewTitle('')
      setNewDesc('')
      setNewEmoji('✅')
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save chore.'
      setActionError(message)
    } finally {
      setAddingChore(false)
    }
  }

  async function handleDeleteChore(id: number) {
    if (!confirm('Delete this chore? It will be removed from the schedule too.')) return
    await deleteChore({ data: { id } })
    if (editingChoreId === id) {
      setEditingChoreId(null)
    }
    await loadData()
  }

  function handleStartEdit(chore: Chore) {
    setEditingChoreId(chore.id)
    setEditTitle(chore.title)
    setEditDesc(chore.description ?? '')
    setEditEmoji(chore.emoji || '✅')
  }

  function handleCancelEdit() {
    setEditingChoreId(null)
    setEditTitle('')
    setEditDesc('')
    setEditEmoji('✅')
  }

  async function handleSaveEdit(id: number) {
    if (!editTitle.trim()) return
    setActionError('')
    setSavingEdit(true)
    try {
      await updateChore({
        data: {
          id,
          title: editTitle.trim(),
          description: editDesc.trim(),
          emoji: editEmoji,
        },
      })
      handleCancelEdit()
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save changes.'
      setActionError(message)
    } finally {
      setSavingEdit(false)
    }
  }

  function handleEditKeyDown(event: React.KeyboardEvent<HTMLInputElement>, id: number) {
    if (event.key === 'Escape') {
      event.preventDefault()
      handleCancelEdit()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      void handleSaveEdit(id)
    }
  }

  async function handleAddToSchedule() {
    if (scheduleChoreId === '') return
    setActionError('')
    setAddingSchedule(true)
    try {
      await addToSchedule({ data: { choreId: Number(scheduleChoreId), dayOfWeek: scheduleDay, assignedTo: scheduleAssign } })
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not add to schedule.'
      setActionError(message)
    } finally {
      setAddingSchedule(false)
    }
  }

  async function handleRemoveFromSchedule(id: number) {
    await removeFromSchedule({ data: { id } })
    await loadData()
  }

  async function handleLogout() {
    await logout()
    // Use a full page load so server route guards see cleared auth cookies.
    window.location.assign('/login')
  }

  function isCompleted(scheduleId: number) {
    return completions.some((c) => c.scheduleId === scheduleId)
  }

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-4xl animate-pulse">🌟</div>
      </div>
    )
  }

  const completedCount = completions.length
  const totalScheduled = schedule.length

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-2 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-center sm:justify-between gap-2 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <span className="text-2xl">🏠</span>
            <div>
              <h1 className="font-bold text-gray-800 leading-tight">Chore Chart</h1>
              <p className="text-xs text-gray-500">
                {user?.name || user?.email} · {isParent ? '👨‍👩‍👧 Parent' : '🧒 Kid'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            {isParent && (
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setView('week')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'week' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                >
                  📅 Week
                </button>
                <button
                  onClick={() => setView('manage')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'manage' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                >
                  ⚙️ Manage
                </button>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {actionError && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}
        {view === 'week' && (
          <>
            {/* Weekly progress */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPreviousWeek}
                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    aria-label="Previous week"
                  >
                    ←
                  </button>
                  <h3 className="font-semibold text-gray-800 min-w-44 text-center text-sm">
                    {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' - '}
                    {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </h3>
                  <button
                    onClick={goToNextWeek}
                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    aria-label="Next week"
                  >
                    →
                  </button>
                  <button
                    onClick={goToCurrentWeek}
                    className="ml-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    This Week
                  </button>
                </div>
                {!isCurrentWeekView && (
                  <span className="text-xs text-gray-400">Completions shown are for the current week only</span>
                )}
              </div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-700">This Week</h2>
                <span className="text-sm font-semibold text-amber-600">
                  {completedCount} / {totalScheduled} done
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-amber-400 h-3 rounded-full transition-all"
                  style={{ width: totalScheduled > 0 ? `${(completedCount / totalScheduled) * 100}%` : '0%' }}
                />
              </div>
              {completedCount === totalScheduled && totalScheduled > 0 && (
                <p className="text-center text-green-600 font-semibold mt-3">🎉 All done this week!</p>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-3 mb-6 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 px-2">Layout</span>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setScheduleLayout('daily')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${scheduleLayout === 'daily' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setScheduleLayout('week-calendar')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${scheduleLayout === 'week-calendar' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                >
                  Week Calendar
                </button>
                <button
                  onClick={() => setScheduleLayout('month-calendar')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${scheduleLayout === 'month-calendar' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                >
                  Month Calendar
                </button>
              </div>
            </div>

            {/* Days of week */}
            {scheduleLayout === 'daily' && (
              <div className="space-y-4">
                {weekDates.map((date) => {
                  const dow = date.getDay()
                  const daySchedule = schedule.filter((s) => s.dayOfWeek === dow)
                  const isToday = isCurrentWeekView && dow === todayDow
                  return (
                    <div
                      key={dow}
                      className={`bg-white rounded-2xl shadow-sm overflow-hidden ${isToday ? 'ring-2 ring-amber-400' : ''}`}
                    >
                      <div className={`px-5 py-3 flex items-center justify-between ${isToday ? 'bg-amber-400' : 'bg-gray-50 border-b'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isToday ? 'text-white' : 'text-gray-700'}`}>
                            {DAYS[dow]}
                          </span>
                          {isToday && <span className="text-white text-xs font-medium bg-amber-500 px-2 py-0.5 rounded-full">Today</span>}
                        </div>
                        <span className={`text-sm ${isToday ? 'text-amber-100' : 'text-gray-400'}`}>
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {daySchedule.length === 0 ? (
                        <div className="px-5 py-4 text-sm text-gray-400 italic">No chores scheduled</div>
                      ) : (
                        <ul className="divide-y divide-gray-50">
                          {daySchedule.map((entry) => {
                            const done = isCompleted(entry.id)
                            return (
                              <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
                                <button
                                  onClick={() => handleMarkComplete(entry.id)}
                                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                    done
                                      ? 'bg-green-400 border-green-400 text-white'
                                      : 'border-gray-300 hover:border-amber-400'
                                  }`}
                                >
                                  {done && '✓'}
                                </button>
                                <span className="text-xl">{entry.choreEmoji}</span>
                                <div className="flex-1 min-w-0">
                                  <p className={`font-medium text-sm ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {entry.choreTitle}
                                  </p>
                                  {entry.choreDescription && (
                                    <p className="text-xs text-gray-400 truncate">{entry.choreDescription}</p>
                                  )}
                                </div>
                                {entry.assignedTo !== 'all' && (
                                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                    {entry.assignedTo === 'parent' ? '👨‍👩‍👧' : '🧒'}
                                  </span>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {scheduleLayout === 'week-calendar' && (
              <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {weekDates.map((date) => {
                    const dow = date.getDay()
                    const isToday = isCurrentWeekView && dow === todayDow
                    return (
                      <div key={`week-head-${dow}`} className={`px-3 py-2 text-center ${isToday ? 'bg-amber-50' : ''}`}>
                        <p className={`text-xs font-semibold ${isToday ? 'text-amber-700' : 'text-gray-500'}`}>{SHORT_DAYS[dow]}</p>
                        <p className={`text-sm font-bold ${isToday ? 'text-amber-700' : 'text-gray-800'}`}>{date.getDate()}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-7">
                  {weekDates.map((date) => {
                    const dow = date.getDay()
                    const daySchedule = schedule.filter((s) => s.dayOfWeek === dow)
                    const isToday = dow === todayDow

                    return (
                      <div
                        key={`week-cell-${dow}`}
                        className={`min-h-44 border-b md:border-b-0 md:border-r border-gray-100 p-3 ${isToday ? 'bg-amber-50/50' : ''} ${dow === 6 ? 'md:border-r-0' : ''}`}
                      >
                        {daySchedule.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No chores</p>
                        ) : (
                          <ul className="space-y-2">
                            {daySchedule.map((entry) => {
                              const done = isCompleted(entry.id)
                              return (
                                <li key={`week-entry-${entry.id}`} className="rounded-lg border border-gray-100 p-2">
                                  <button
                                    onClick={() => handleMarkComplete(entry.id)}
                                    className="flex items-start gap-2 w-full text-left"
                                  >
                                    <span className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-xs ${done ? 'bg-green-400 border-green-400 text-white' : 'border-gray-300 text-transparent'}`}>
                                      ✓
                                    </span>
                                    <span className="text-base leading-none">{entry.choreEmoji}</span>
                                    <span className={`text-xs font-medium ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                      {entry.choreTitle}
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {scheduleLayout === 'month-calendar' && (
              <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={goToPreviousMonth}
                      className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      aria-label="Previous month"
                    >
                      ←
                    </button>
                    <h3 className="font-semibold text-gray-800 min-w-36 text-center">
                      {calendarMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={goToNextMonth}
                      className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      aria-label="Next month"
                    >
                      →
                    </button>
                    <button
                      onClick={goToCurrentMonth}
                      className="ml-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Today
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">Weekly schedule repeated across the month</span>
                </div>
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {SHORT_DAYS.map((day) => (
                    <div key={`month-head-${day}`} className="px-2 py-2 text-center text-xs font-semibold text-gray-500">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthGridDates.map((date) => {
                    const dow = date.getDay()
                    const inActiveMonth = date.getMonth() === activeMonth
                    const daySchedule = inActiveMonth ? schedule.filter((s) => s.dayOfWeek === dow) : []
                    const isToday = inActiveMonth && isSameCalendarDay(date, today)
                    const isInCurrentWeek = weekDateKeys.has(toDateKey(date))

                    return (
                      <div
                        key={`month-cell-${toDateKey(date)}`}
                        className={`min-h-32 border-r border-b border-gray-100 p-2 ${inActiveMonth ? 'bg-white' : 'bg-gray-50'} ${isToday ? 'ring-2 ring-inset ring-amber-400' : ''}`}
                      >
                        {inActiveMonth && (
                          <div className="text-xs font-semibold mb-2 text-gray-700">
                            {date.getDate()}
                          </div>
                        )}
                        {inActiveMonth && daySchedule.length > 0 && (
                          <ul className="space-y-1">
                            {daySchedule.slice(0, 3).map((entry) => {
                              const done = isInCurrentWeek ? isCompleted(entry.id) : false
                              return (
                                <li key={`month-entry-${toDateKey(date)}-${entry.id}`}>
                                  <button
                                    onClick={() => isInCurrentWeek && handleMarkComplete(entry.id)}
                                    disabled={!isInCurrentWeek}
                                    className={`w-full rounded-md px-1.5 py-1 text-left text-[11px] border transition-colors ${done ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-700'} ${!isInCurrentWeek ? 'opacity-80 cursor-default' : 'hover:border-amber-300'}`}
                                  >
                                    <span className="mr-1">{entry.choreEmoji}</span>
                                    {entry.choreTitle}
                                  </button>
                                </li>
                              )
                            })}
                            {daySchedule.length > 3 && (
                              <li className="text-[11px] text-gray-400 px-1">+{daySchedule.length - 3} more</li>
                            )}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {view === 'manage' && isParent && (
          <div className="space-y-8">
            {/* Chore library */}
            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-4">📋 Chore Library</h2>

              {/* Add chore form */}
              <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
                <h3 className="font-semibold text-gray-700 mb-3">Add a new chore</h3>
                <div className="flex gap-2 flex-wrap mb-2 justify-center sm:justify-start">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setNewEmoji(e)}
                      className={`w-9 h-9 rounded-lg text-xl transition-all ${newEmoji === e ? 'bg-amber-100 ring-2 ring-amber-400' : 'hover:bg-gray-100'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full">
                  <input
                    type="text"
                    placeholder="Chore name"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={handleCreateChore}
                    disabled={addingChore || !newTitle.trim()}
                    className="bg-amber-400 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Chore list */}
              {choresList.length === 0 ? (
                <p className="text-gray-400 text-sm italic px-2">No chores yet. Add one above!</p>
              ) : (
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {choresList.map((chore) => (
                    <div key={chore.id} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3">
                      {editingChoreId === chore.id ? (
                        <div className="flex-1 min-w-0">
                          <div className="flex gap-1 flex-wrap mb-2">
                            {EMOJIS.map((emoji) => (
                              <button
                                key={`${chore.id}-${emoji}`}
                                onClick={() => setEditEmoji(emoji)}
                                className={`w-8 h-8 rounded-lg text-lg transition-all ${editEmoji === emoji ? 'bg-amber-100 ring-2 ring-amber-400' : 'hover:bg-gray-100'}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, chore.id)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                              placeholder="Chore name"
                            />
                            <input
                              type="text"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, chore.id)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                              placeholder="Description (optional)"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(chore.id)}
                                disabled={savingEdit || !editTitle.trim()}
                                className="bg-amber-400 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="text-2xl">{chore.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-800">{chore.title}</p>
                            {chore.description && <p className="text-xs text-gray-400 truncate">{chore.description}</p>}
                          </div>
                          <button
                            onClick={() => handleStartEdit(chore)}
                            className="text-xs text-gray-400 hover:text-amber-600 transition-colors px-2 py-1 rounded"
                            title="Edit chore"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteChore(chore.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                            title="Delete chore"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Weekly schedule builder */}
            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-4">📅 Weekly Schedule</h2>

              {/* Add to schedule form */}
              <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
                <h3 className="font-semibold text-gray-700 mb-3">Assign chore to a day</h3>
                {choresList.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Add chores above first.</p>
                ) : (
                  <div className="flex gap-2 flex-wrap items-end">
                    <select
                      value={scheduleChoreId}
                      onChange={(e) => setScheduleChoreId(e.target.value === '' ? '' : Number(e.target.value))}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="">Select chore…</option>
                      {choresList.map((c) => (
                        <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>
                      ))}
                    </select>
                    <select
                      value={scheduleDay}
                      onChange={(e) => setScheduleDay(Number(e.target.value))}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {DAYS.map((day, i) => (
                        <option key={i} value={i}>{day}</option>
                      ))}
                    </select>
                    <select
                      value={scheduleAssign}
                      onChange={(e) => setScheduleAssign(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="all">Everyone</option>
                      <option value="parent">Parent only</option>
                      <option value="kid">Kid only</option>
                    </select>
                    <button
                      onClick={handleAddToSchedule}
                      disabled={addingSchedule || scheduleChoreId === ''}
                      className="bg-amber-400 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      Add to schedule
                    </button>
                  </div>
                )}
              </div>

              {/* Schedule by day */}
              {DAYS.map((dayName, dow) => {
                const daySchedule = schedule.filter((s) => s.dayOfWeek === dow)
                if (daySchedule.length === 0) return null
                return (
                  <div key={dow} className="bg-white rounded-2xl shadow-sm overflow-hidden mb-3">
                    <div className="bg-gray-50 border-b px-5 py-2.5">
                      <span className="font-semibold text-gray-700 text-sm">{dayName}</span>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {daySchedule.map((entry) => (
                        <li key={entry.id} className="flex items-center gap-3 px-5 py-2.5">
                          <span className="text-lg">{entry.choreEmoji}</span>
                          <span className="flex-1 text-sm text-gray-800">{entry.choreTitle}</span>
                          <span className="text-xs text-gray-400">
                            {entry.assignedTo === 'all' ? 'Everyone' : entry.assignedTo === 'parent' ? '👨‍👩‍👧 Parent' : '🧒 Kid'}
                          </span>
                          <button
                            onClick={() => handleRemoveFromSchedule(entry.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none ml-2"
                            title="Remove from schedule"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
              {schedule.length === 0 && (
                <p className="text-gray-400 text-sm italic px-2">No chores scheduled yet.</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
