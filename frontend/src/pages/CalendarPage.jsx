import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { yyyy_mm_dd } from '../utils/formatters.js'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function DayCell({ day, today, attendance, onClick }) {
  if (!day) return <div className="h-24 bg-slate-50/50 dark:bg-slate-800/30" />

  const dateStr = yyyy_mm_dd(day)
  const isToday = dateStr === today
  const att = attendance.find((a) => a.date === dateStr)

  const statusColors = {
    present: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
    half_day: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
    leave: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
    absent: 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600',
  }

  const isWeekend = day.getDay() === 0 || day.getDay() === 6
  const isFuture = day > new Date()

  return (
    <button
      onClick={() => onClick?.(dateStr)}
      className={`h-24 p-1.5 border text-left transition-all hover:ring-2 hover:ring-brand-400/50 ${
        isToday ? 'ring-2 ring-brand-500 border-brand-300 dark:border-brand-600' :
        att ? statusColors[att.status] || 'border-slate-200 dark:border-slate-700' :
        isWeekend ? 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50' :
        isFuture ? 'bg-white/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-700/50' :
        'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className={`text-xs font-bold ${isToday ? 'text-brand-600 dark:text-brand-400' : isWeekend ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
        {day.getDate()}
      </div>
      {att && (
        <div className="mt-1 space-y-0.5">
          {att.check_in && (
            <div className="text-[9px] font-mono text-green-700 dark:text-green-400">
              In: {att.check_in.slice(0, 5)}
            </div>
          )}
          {att.check_out && (
            <div className="text-[9px] font-mono text-red-600 dark:text-red-400">
              Out: {att.check_out.slice(0, 5)}
            </div>
          )}
          {att.status === 'leave' && (
            <div className="text-[9px] font-semibold text-red-600 dark:text-red-400">🏖️ Leave</div>
          )}
          {att.status === 'present' && !att.check_in && (
            <div className="text-[9px] font-semibold text-green-600 dark:text-green-400">✓ Present</div>
          )}
          {att.status === 'absent' && (
            <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">Absent</div>
          )}
        </div>
      )}
      {isToday && (
        <div className="mt-auto pt-1">
          <span className="text-[8px] font-bold text-brand-600 dark:text-brand-400 uppercase">Today</span>
        </div>
      )}
    </button>
  )
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [attendance, setAttendance] = useState([])
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const startDate = yyyy_mm_dd(firstDay)
      const endDate = yyyy_mm_dd(lastDay)

      // Fetch attendance for the month
      const attPromises = []
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dateStr = yyyy_mm_dd(d)
        attPromises.push(
          (user?.role === 'admin' || user?.role === 'hr'
            ? api.get('/attendance/all', { params: { date: dateStr } }).catch(() => ({ data: [] }))
            : api.get('/attendance/my/daily', { params: { start_date: dateStr, end_date: dateStr } }).catch(() => ({ data: [] }))
          ).then((r) => r.data.map((rec) => ({
            date: rec.attendance_date || dateStr,
            status: rec.status,
            check_in: rec.check_in_time,
            check_out: rec.check_out_time,
            user_id: rec.user_id,
          })))
        )
      }
      const results = await Promise.all(attPromises)
      setAttendance(results.flat())

      // Fetch leaves for the month
      const { data: leaveData } = await api.get('/leave/my/requests', {
        params: { skip: 0, limit: 50 }
      }).catch(() => ({ data: [] }))
      setLeaves(leaveData || [])
    } catch (e) {
      toast.error(extractError(e, 'Failed to load calendar'))
    } finally {
      setLoading(false)
    }
  }, [year, month, user])

  useEffect(() => { load() }, [load])

  const today = yyyy_mm_dd(new Date())

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  // Stats for the month
  const presentDays = attendance.filter((a) => a.status === 'present' || a.status === 'half_day').length
  const absentDays = attendance.filter((a) => a.status === 'absent').length
  const leaveDays = attendance.filter((a) => a.status === 'leave').length
  const totalWorkDays = presentDays + absentDays + leaveDays

  // Selected date details
  const selectedAtt = selectedDate ? attendance.filter((a) => a.date === selectedDate) : []

  return (
    <div className="space-y-6 animate-slideUp">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">Calendar</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {MONTHS[month]} {year}
          </h1>
        </div>
        <Link to="/attendance" className="btn-outline text-sm">📋 Table View →</Link>
      </div>

      {/* Month Navigation + Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(new Date(year, month - 1))}
            className="btn-ghost !px-3"
          >
            ← Prev
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="btn-outline text-sm"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(new Date(year, month + 1))}
            className="btn-ghost !px-3"
          >
            Next →
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500" /> {presentDays} Present
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500" /> {leaveDays} Leave
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> {absentDays} Absent
          </span>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading calendar…" />
      ) : (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-3 card overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {d}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {cells.map((day, i) => (
                <DayCell
                  key={i}
                  day={day}
                  today={today}
                  attendance={attendance}
                  onClick={setSelectedDate}
                />
              ))}
            </div>
          </div>

          {/* Sidebar: Selected date details + Legend */}
          <div className="space-y-4">
            {/* Legend */}
            <div className="card card-body">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Legend</h3>
              <div className="space-y-2 text-xs">
                {[
                  { color: 'bg-green-400', label: 'Present / Checked in' },
                  { color: 'bg-amber-400', label: 'Half day' },
                  { color: 'bg-red-400', label: 'On leave' },
                  { color: 'bg-slate-300 dark:bg-slate-600', label: 'Absent' },
                  { color: 'bg-white border-2 border-brand-400', label: 'Today' },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${l.color}`} />
                    <span className="text-slate-600 dark:text-slate-400">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Date Details */}
            {selectedDate && (
              <div className="card card-body">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                {selectedAtt.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No records for this day.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedAtt.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                        <div>
                          <span className={`font-semibold capitalize ${a.status === 'present' ? 'text-green-600' : a.status === 'leave' ? 'text-red-600' : 'text-slate-600'}`}>
                            {a.status}
                          </span>
                          {a.check_in && <span className="text-slate-500 ml-1">· {a.check_in.slice(0, 5)}</span>}
                          {a.check_out && <span className="text-slate-500"> – {a.check_out.slice(0, 5)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Monthly Summary */}
            <div className="card card-body">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">Monthly Summary</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Working days</span>
                  <span className="font-bold text-slate-900 dark:text-white">{totalWorkDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Attendance rate</span>
                  <span className="font-bold text-green-600">
                    {totalWorkDays > 0 ? Math.round((presentDays / totalWorkDays) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Leave days</span>
                  <span className="font-bold text-red-600">{leaveDays}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
