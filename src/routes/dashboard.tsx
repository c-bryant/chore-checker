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

function getWeekDates() {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function todayDayOfWeek() {
  return new Date().getDay()
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
  const isParent = user?.roles?.includes('parent')

  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [choresList, setChoresList] = useState<Chore[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'week' | 'manage'>('week')

  // New chore form
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newEmoji, setNewEmoji] = useState('✅')
  const [addingChore, setAddingChore] = useState(false)

  // Add to schedule form
  const [scheduleChoreId, setScheduleChoreId] = useState<number | ''>('')
  const [scheduleDay, setScheduleDay] = useState<number>(1)
  const [scheduleAssign, setScheduleAssign] = useState<string>('all')
  const [addingSchedule, setAddingSchedule] = useState(false)

  const weekDates = getWeekDates()
  const todayDow = todayDayOfWeek()

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
      setSchedule(sched as ScheduleEntry[])
      setCompletions(comps as Completion[])
      setChoresList(chrs as Chore[])
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
    setAddingChore(true)
    try {
      await createChore({ data: { title: newTitle.trim(), description: newDesc.trim(), emoji: newEmoji } })
      setNewTitle('')
      setNewDesc('')
      setNewEmoji('✅')
      await loadData()
    } finally {
      setAddingChore(false)
    }
  }

  async function handleDeleteChore(id: number) {
    if (!confirm('Delete this chore? It will be removed from the schedule too.')) return
    await deleteChore({ data: { id } })
    await loadData()
  }

  async function handleAddToSchedule() {
    if (scheduleChoreId === '') return
    setAddingSchedule(true)
    try {
      await addToSchedule({ data: { choreId: Number(scheduleChoreId), dayOfWeek: scheduleDay, assignedTo: scheduleAssign } })
      await loadData()
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
    navigate({ to: '/login' })
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
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <h1 className="font-bold text-gray-800 leading-tight">Chore Chart</h1>
              <p className="text-xs text-gray-500">
                {user?.name || user?.email} · {isParent ? '👨‍👩‍👧 Parent' : '🧒 Kid'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

      <main className="max-w-5xl mx-auto px-4 py-6">
        {view === 'week' && (
          <>
            {/* Weekly progress */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
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

            {/* Days of week */}
            <div className="space-y-4">
              {weekDates.map((date, idx) => {
                // weekDates starts from Monday (idx 0 = Mon), but dayOfWeek 1 = Mon
                const dow = date.getDay()
                const daySchedule = schedule.filter((s) => s.dayOfWeek === dow)
                const isToday = dow === todayDow
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
                <div className="flex gap-2 flex-wrap mb-2">
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
                <div className="flex gap-2 mt-2">
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
                <div className="grid gap-2 sm:grid-cols-2">
                  {choresList.map((chore) => (
                    <div key={chore.id} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3">
                      <span className="text-2xl">{chore.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-800">{chore.title}</p>
                        {chore.description && <p className="text-xs text-gray-400 truncate">{chore.description}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteChore(chore.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                        title="Delete chore"
                      >
                        ×
                      </button>
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
