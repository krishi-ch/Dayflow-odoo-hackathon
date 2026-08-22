import React, { useEffect, useMemo, useState } from 'react'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import StatCard from '../components/StatCard.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  formatDate, formatTime, minutesToHrs, statusBadge, yyyy_mm_dd, addDays, formatDateTime,
} from '../utils/formatters.js'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

export default function AttendancePage() {
  const { user, isAdmin } = useAuth()
  const [range, setRange] = useState(() => {
    const end = new Date(); const start = addDays(end, -13)
    return { start: yyyy_mm_dd(start), end: yyyy_mm_dd(end) }
  })
  const [view, setView] = useState('daily') // daily | weekly
  const [records, setRecords] = useState([])
  const [stats, setStats] = useState(null)
  const [employees, setEmployees] = useState([])
  const [selectedEmp, setSelectedEmp] = useState(null) // for admin view-single
  const [adminDate, setAdminDate] = useState(yyyy_mm_dd())
  const [todayRec, setTodayRec] = useState(null)
  const [tab, setTab] = useState(() => isAdmin ? 'team' : 'mine')
  const [loading, setLoading] = useState(true)

  const mine = async () => {
    setLoading(true)
    try {
      const [{ data: r }, { data: st }, { data: t }] = await Promise.all([
        api.get('/attendance/my/daily', { params: { start_date: range.start, end_date: range.end } }),
        api.get('/attendance/my/stats', { params: { start_date: range.start, end_date: range.end } }),
        api.get('/attendance/today'),
      ])
      setRecords(r); setStats(st); setTodayRec(t)
    } catch (e) { toast.error(extractError(e)) }
    finally { setLoading(false) }
  }

  const loadTeam = async () => {
    setLoading(true)
    try {
      const [{ data: all }, { data: emps }] = await Promise.all([
        api.get('/attendance/all', { params: { date: adminDate } }),
        api.get('/employees', { params: { limit: 200 } }),
      ])
      setRecords(all); setEmployees(emps)
    } catch (e) { toast.error(extractError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'mine') mine()
    else loadTeam()
  }, [range, tab, adminDate])

  const checkIn = async () => {
    try {
      const { data } = await api.post('/attendance/check-in', {})
      setTodayRec(data); toast.success(`Checked in at ${formatTime(data.check_in_time)}`)
      mine()
    } catch (e) { toast.error(extractError(e)) }
  }
  const checkOut = async () => {
    try {
      const { data } = await api.post('/attendance/check-out', {})
      setTodayRec(data); toast.success(`Checked out at ${formatTime(data.check_out_time)}`)
      mine()
    } catch (e) { toast.error(extractError(e)) }
  }

  const updateStatus = async (row, status, remarks = row.remarks) => {
    try {
      await api.put(`/attendance/employee/${row.user_id}/${row.attendance_date}`, { status, remarks })
      toast.success(`Marked as ${status}`)
      loadTeam()
    } catch (e) { toast.error(extractError(e)) }
  }

  const chartData = useMemo(() => {
    if (tab === 'team') {
      // pivot: per-status counts for selected day
      const counts = { present: 0, absent: 0, half_day: 0, leave: 0 }
      records.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1 })
      return [
        { name: 'Present', v: counts.present, color: '#10b981' },
        { name: 'Half-Day', v: counts.half_day, color: '#f59e0b' },
        { name: 'Leave', v: counts.leave, color: '#3b82f6' },
        { name: 'Absent', v: counts.absent, color: '#ef4444' },
      ]
    }
    // mine: per-day worked hours
    const map = {}
    records.forEach((r) => {
      map[r.attendance_date] = {
        label: formatDate(r.attendance_date, { day: '2-digit', month: 'short' }),
        hours: (r.work_duration_minutes || 0) / 60,
        status: r.status,
      }
    })
    // ensure range rows are present
    const start = new Date(range.start), end = new Date(range.end)
    const out = []
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const k = yyyy_mm_dd(d)
      if (map[k]) out.push({ label: map[k].label, ...map[k] })
      else out.push({ label: formatDate(d, { day: '2-digit', month: 'short' }), hours: 0, status: 'unknown' })
    }
    return out
  }, [records, tab, range])

  return (
    <div className="space-y-6 animate-slideUp">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Attendance module</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Attendance</h1>
          <p className="mt-1 text-slate-500 text-sm">Check in / check out, daily & weekly views, approvals by HR/Admin</p>
        </div>
        {tab === 'mine' && (
          <div className="flex gap-2 flex-wrap">
            {todayRec?.check_out_time ? (
              <div className="card-body !py-2 !px-4 text-sm">Checked out <b>{formatTime(todayRec.check_out_time)}</b></div>
            ) : todayRec ? (
              <button className="btn-warning" onClick={checkOut}>⏹ Check out</button>
            ) : (
              <button className="btn-success" onClick={checkIn}>▶ Check in</button>
            )}
          </div>
        )}
      </header>

      {isAdmin && (
        <div className="card card-body flex flex-wrap items-center gap-3 p-3">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'mine' ? 'bg-white text-slate-900 shadow-card' : 'text-slate-600'}`}
              onClick={() => setTab('mine')}>👤 My Attendance</button>
            <button className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'team' ? 'bg-white text-slate-900 shadow-card' : 'text-slate-600'}`}
              onClick={() => setTab('team')}>🧑‍🤝‍🧑 Team Attendance</button>
          </div>
          {tab === 'mine' ? (
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <span className="text-xs text-slate-500 font-semibold uppercase">Range</span>
              <input type="date" className="input !py-2" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
              <span>to</span>
              <input type="date" className="input !py-2" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button onClick={() => setView('daily')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${view === 'daily' ? 'bg-white shadow-card text-slate-900' : 'text-slate-600'}`}>Daily</button>
                <button onClick={() => setView('weekly')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${view === 'weekly' ? 'bg-white shadow-card text-slate-900' : 'text-slate-600'}`}>Weekly</button>
              </div>
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <label className="text-xs text-slate-500 font-semibold uppercase">Date</label>
              <input type="date" className="input !py-2" value={adminDate} onChange={(e) => setAdminDate(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {tab === 'mine' ? (
        <section className="grid md:grid-cols-4 gap-4">
          <StatCard title="Present days" value={stats?.present_days ?? 0} icon="✅" tone="green" />
          <StatCard title="Absent days" value={stats?.absent_days ?? 0} icon="🔴" tone="rose" />
          <StatCard title="Half days" value={stats?.half_day_days ?? 0} icon="🕒" tone="amber" />
          <StatCard title="Avg work hrs / day" value={`${stats?.average_work_hours ?? 0}h`} hint={`Total ${minutesToHrs(stats?.total_worked_minutes || 0)} worked`} icon="⏱️" tone="violet" />
        </section>
      ) : (
        <section className="grid md:grid-cols-4 gap-4">
          <StatCard title="Marked today" value={records.length} icon="📋" tone="brand" hint={adminDate} />
          <StatCard title="Present"
            value={records.filter(r => r.status === 'present').length} icon="✅" tone="green" />
          <StatCard title="On Leave"
            value={records.filter(r => r.status === 'leave').length} icon="🏖️" tone="violet" />
          <StatCard title="Absent"
            value={records.filter(r => r.status === 'absent').length} icon="🔴" tone="rose" />
        </section>
      )}

      <section className="card">
        <div className="px-5 pt-5">
          <h3 className="font-bold text-slate-900">
            {tab === 'mine' ? `Your attendance trend · ${formatDate(range.start)} to ${formatDate(range.end)}`
              : `Team status distribution on ${formatDate(adminDate)}`}
          </h3>
          <p className="text-sm text-slate-500">
            {tab === 'mine' ? 'Hours worked per calendar day' : `Total ${employees.length} active employees · ${records.length} marked attendance`}
          </p>
        </div>
        <div className="h-72 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={tab === 'team' ? 'name' : 'label'} stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey={tab === 'team' ? 'v' : 'hours'} radius={[10, 10, 0, 0]}
                fill={tab === 'team' ? undefined : '#3b82f6'}>
                {tab === 'team' && chartData.map((d, i) => (
                  <rect key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <div className="px-5 pt-5 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">
            {tab === 'mine' ? 'Records' : `All attendance — ${formatDate(adminDate)}`}
          </h3>
          <span className="badge-muted">{records.length} rows</span>
        </div>
        <div className="p-5 overflow-x-auto">
          {loading ? (
            <LoadingSpinner full text="Loading attendance records…" />
          ) : records.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">
              {tab === 'mine' ? 'No records in this range yet.' : 'No records marked for this date yet.'}
            </div>
          ) : (
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="table-head">
                  {tab === 'team' && <th>Employee</th>}
                  <th>Date</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Worked</th>
                  <th>Late / Early</th>
                  <th>Status</th>
                  <th>Marked</th>
                  {tab === 'team' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.attendance_id} className="table-row">
                    {tab === 'team' && <td className="font-semibold text-slate-800">{r.employee_name || `User ${r.user_id}`}</td>}
                    <td>{formatDate(r.attendance_date)}</td>
                    <td className="font-mono text-xs">{formatTime(r.check_in_time)}</td>
                    <td className="font-mono text-xs">{formatTime(r.check_out_time)}</td>
                    <td>{minutesToHrs(r.work_duration_minutes)}</td>
                    <td className="text-xs">
                      {r.late_arrival_minutes ? <span className="text-warning-600 font-semibold">+{r.late_arrival_minutes}m late</span> : '—'}
                      {' / '}
                      {r.early_leave_minutes ? <span className="text-warning-600 font-semibold">+{r.early_leave_minutes}m early</span> : '—'}
                    </td>
                    <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                    <td className="text-xs text-slate-500">{formatDateTime(r.created_at)}</td>
                    {tab === 'team' && (
                      <td>
                        <select className="input !py-1.5 text-xs"
                          value={r.status}
                          onChange={(e) => updateStatus(r, e.target.value)}
                        >
                          <option value="present">present</option>
                          <option value="absent">absent</option>
                          <option value="half_day">half_day</option>
                          <option value="leave">leave</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
