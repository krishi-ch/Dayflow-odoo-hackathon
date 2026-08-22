import React, { useEffect, useMemo, useState } from 'react'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  formatDate, formatTime, minutesToHrs, statusBadge, yyyy_mm_dd, addDays,
} from '../utils/formatters.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getMonthRange(year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return { start: yyyy_mm_dd(start), end: yyyy_mm_dd(end) }
}

function EmployeeAttendanceView() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [records, setRecords] = useState([])
  const [todayRec, setTodayRec] = useState(null)
  const [loading, setLoading] = useState(true)

  const { start, end } = getMonthRange(year, month)

  const load = async () => {
    setLoading(true)
    try {
      const [{ data: r }, { data: t }] = await Promise.all([
        api.get('/attendance/my/daily', { params: { start_date: start, end_date: end } }),
        api.get('/attendance/today').catch(() => ({ data: null })),
      ])
      setRecords(r)
      setTodayRec(t)
    } catch (e) { toast.error(extractError(e)) }
    setLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  // Summary stats
  const presentCount = records.filter((r) => r.status === 'present' || r.status === 'half_day').length
  const leaveCount = records.filter((r) => r.status === 'leave').length
  const totalDays = new Date(year, month + 1, 0).getDate()

  const checkIn = async () => {
    try {
      const { data } = await api.post('/attendance/check-in', {})
      setTodayRec(data)
      toast.success(`Checked in at ${formatTime(data.check_in_time)}`)
      load()
    } catch (e) { toast.error(extractError(e)) }
  }

  const checkOut = async () => {
    try {
      const { data } = await api.post('/attendance/check-out', {})
      setTodayRec(data)
      toast.success(`Checked out at ${formatTime(data.check_out_time)}`)
      load()
    } catch (e) { toast.error(extractError(e)) }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="card card-body !py-3 !px-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-ghost !px-2 !py-1.5" onClick={prevMonth}>←</button>
          <button className="btn-ghost !px-2 !py-1.5" onClick={nextMonth}>→</button>
          <select className="input !py-2 !w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {todayRec && !todayRec.check_out_time ? (
            <button className="btn-warning" onClick={checkOut}>⏹ Check out</button>
          ) : !todayRec ? (
            <button className="btn-success" onClick={checkIn}>▶ Check in</button>
          ) : (
            <span className="text-sm text-slate-500">Checked out at <b>{formatTime(todayRec.check_out_time)}</b></span>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card card-body text-center !py-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Days Present</div>
          <div className="text-3xl font-extrabold text-success-600 mt-1">{presentCount}</div>
        </div>
        <div className="card card-body text-center !py-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Leaves</div>
          <div className="text-3xl font-extrabold text-danger-600 mt-1">{leaveCount}</div>
        </div>
        <div className="card card-body text-center !py-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Total Working Days</div>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">{totalDays}</div>
        </div>
      </div>

      {/* Date Header */}
      <div className="text-center">
        <h3 className="font-bold text-slate-900">{formatDate(new Date(year, month, now.getDate()))}</h3>
      </div>

      {/* Attendance Table */}
      <div className="card">
        <div className="p-5 overflow-x-auto">
          {loading ? (
            <LoadingSpinner text="Loading attendance…" />
          ) : records.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">No attendance records for this month.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="table-head">
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Work Hours</th>
                  <th>Extra Hours</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const workHrs = r.work_duration_minutes ? (r.work_duration_minutes / 60).toFixed(2) : '—'
                  const extraHrs = r.work_duration_minutes && r.work_duration_minutes > 540
                    ? ((r.work_duration_minutes - 540) / 60).toFixed(2)
                    : '00:00'
                  return (
                    <tr key={r.attendance_id} className="table-row">
                      <td className="font-semibold text-slate-800">{formatDate(r.attendance_date)}</td>
                      <td className="font-mono text-sm">{formatTime(r.check_in_time)}</td>
                      <td className="font-mono text-sm">{formatTime(r.check_out_time)}</td>
                      <td className="font-semibold">{workHrs} hrs</td>
                      <td className="font-semibold text-brand-600">{extraHrs} hrs</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function AdminAttendanceView() {
  const [date, setDate] = useState(yyyy_mm_dd())
  const [records, setRecords] = useState([])
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [{ data: all }, { data: emps }] = await Promise.all([
        api.get('/attendance/all', { params: { date } }),
        api.get('/dashboard/employees'),
      ])
      setRecords(all)
      setEmployees(emps)
    } catch (e) { toast.error(extractError(e)) }
    setLoading(false)
  }

  useEffect(() => { load() }, [date])

  const prevDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    setDate(yyyy_mm_dd(d))
  }
  const nextDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    setDate(yyyy_mm_dd(d))
  }

  const updateStatus = async (row, status) => {
    try {
      await api.put(`/attendance/employee/${row.user_id}/${row.attendance_date}`, { status, remarks: row.remarks })
      toast.success(`Marked as ${status}`)
      load()
    } catch (e) { toast.error(extractError(e)) }
  }

  const filtered = records.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (r.employee_name || '').toLowerCase().includes(q) || String(r.user_id).includes(q)
  })

  // Build enriched rows: combine attendance with employee list
  const enrichedRows = useMemo(() => {
    const attMap = {}
    records.forEach((r) => { attMap[r.user_id] = r })
    return employees.map((emp) => ({
      ...emp,
      ...(attMap[emp.user_id] || {}),
      hasAtt: !!attMap[emp.user_id],
    })).filter((r) => {
      if (!search) return true
      const q = search.toLowerCase()
      const name = r.profile ? `${r.profile.first_name} ${r.profile.last_name}`.toLowerCase() : ''
      return name.includes(q) || r.employee_id?.toLowerCase().includes(q)
    })
  }, [records, employees, search])

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="card card-body !py-3 !px-4 flex flex-wrap items-center gap-3">
        <input
          className="input md:w-80"
          placeholder="🔍 Search by employee name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-2 ml-auto">
          <button className="btn-ghost !px-2 !py-1.5" onClick={prevDay}>←</button>
          <button className="btn-ghost !px-2 !py-1.5" onClick={nextDay}>→</button>
          <input type="date" className="input !py-2" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="text-sm font-semibold text-slate-700">
            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
          </span>
        </div>
      </div>

      {/* Date Header */}
      <div className="text-center">
        <h3 className="font-bold text-slate-900">{formatDate(date)}</h3>
      </div>

      {/* Attendance Table */}
      <div className="card">
        <div className="p-5 overflow-x-auto">
          {loading ? (
            <LoadingSpinner text="Loading attendance…" />
          ) : enrichedRows.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">No attendance records for this date.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="table-head">
                  <th>Employee</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Work Hours</th>
                  <th>Extra Hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrichedRows.map((r) => {
                  const name = r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : `User ${r.user_id}`
                  const workHrs = r.work_duration_minutes ? (r.work_duration_minutes / 60).toFixed(2) : '—'
                  const extraHrs = r.work_duration_minutes && r.work_duration_minutes > 540
                    ? ((r.work_duration_minutes - 540) / 60).toFixed(2)
                    : '00:00'
                  return (
                    <tr key={r.user_id} className="table-row">
                      <td className="font-semibold text-slate-800">{name}</td>
                      <td className="font-mono text-sm">{r.hasAtt ? formatTime(r.check_in_time) : '—'}</td>
                      <td className="font-mono text-sm">{r.hasAtt ? formatTime(r.check_out_time) : '—'}</td>
                      <td className="font-semibold">{r.hasAtt ? `${workHrs} hrs` : '—'}</td>
                      <td className="font-semibold text-brand-600">{r.hasAtt ? `${extraHrs} hrs` : '—'}</td>
                      <td>
                        {r.hasAtt ? (
                          <span className={statusBadge(r.status)}>{r.status}</span>
                        ) : (
                          <span className="badge-muted">No record</span>
                        )}
                      </td>
                      <td>
                        {r.hasAtt && (
                          <select
                            className="input !py-1.5 text-xs !w-auto"
                            value={r.status}
                            onChange={(e) => updateStatus(r, e.target.value)}
                          >
                            <option value="present">present</option>
                            <option value="absent">absent</option>
                            <option value="half_day">half_day</option>
                            <option value="leave">leave</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AttendancePage() {
  const { isAdmin } = useAuth()

  return (
    <div className="space-y-6 animate-slideUp">
      <header>
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Attendance</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Attendance</h1>
      </header>

      {isAdmin ? <AdminAttendanceView /> : <EmployeeAttendanceView />}
    </div>
  )
}
