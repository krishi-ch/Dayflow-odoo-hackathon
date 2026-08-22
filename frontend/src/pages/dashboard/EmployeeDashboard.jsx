import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { extractError } from '../../utils/api.js'
import { toast } from '../../components/Toast.jsx'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import StatCard from '../../components/StatCard.jsx'
import Avatar from '../../components/Avatar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate, formatMoney, statusBadge, yyyy_mm_dd, addDays } from '../../utils/formatters.js'

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [todayAtt, setTodayAtt] = useState(null)
  const [recentLeaves, setRecentLeaves] = useState([])
  const [balances, setBalances] = useState([])
  const [checking, setChecking] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [myAttendance, setMyAttendance] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshStats = async () => {
    try {
      const { data } = await api.get('/dashboard/employee')
      setStats(data)
    } catch (e) { toast.error(extractError(e, 'Stats failed')) }
  }
  const refreshToday = async () => {
    try {
      const { data } = await api.get('/attendance/today')
      setTodayAtt(data)
    } catch {}
  }
  const refreshLeaves = async () => {
    try {
      const { data } = await api.get('/leave/my/requests', { params: { limit: 5 } })
      setRecentLeaves(data)
    } catch {}
  }
  const refreshBalances = async () => {
    try {
      const { data } = await api.get('/leave/balances/my')
      setBalances(data)
    } catch {}
  }
  const refreshRecentAttendance = async () => {
    const today = yyyy_mm_dd()
    const from = yyyy_mm_dd(addDays(new Date(), -13))
    try {
      const { data } = await api.get('/attendance/my/daily', { params: { start_date: from, end_date: today } })
      setMyAttendance(data)
    } catch {}
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([refreshStats(), refreshToday(), refreshLeaves(), refreshBalances(), refreshRecentAttendance()])
      setLoading(false)
    }
    init()
  }, [])

  const doCheckIn = async () => {
    setChecking(true)
    try {
      const { data } = await api.post('/attendance/check-in', {})
      setTodayAtt(data)
      toast.success(`Checked in at ${data.check_in_time?.slice(0, 5)} 🎉`)
      refreshStats()
    } catch (e) { toast.error(extractError(e)) }
    finally { setChecking(false) }
  }
  const doCheckOut = async () => {
    setCheckingOut(true)
    try {
      const { data } = await api.post('/attendance/check-out', {})
      setTodayAtt(data)
      toast.success(`Checked out at ${data.check_out_time?.slice(0, 5)}. Have a nice evening! 🌙`)
      refreshStats()
    } catch (e) { toast.error(extractError(e)) }
    finally { setCheckingOut(false) }
  }

  if (loading) return <LoadingSpinner full text="Loading your dashboard…" />

  const presenceEmoji = stats?.present_today ? ({
    present: '✅', absent: '🔴', half_day: '🕒', leave: '🏖️',
  }[stats.present_today] || '—') : '⏳'

  return (
    <div className="space-y-6 animate-slideUp">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Employee workspace</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hey {user?.email?.split('@')[0] || 'there'} 👋
          </h1>
          <p className="mt-1 text-slate-500 text-sm">Here's everything you need for today, aligned.</p>
        </div>
        <div className="flex items-center gap-2">
          {todayAtt ? (
            todayAtt.check_out_time ? (
              <div className="card-body py-2 px-4 !bg-slate-50 text-sm">
                Checked out <span className="font-bold text-slate-800">{todayAtt.check_out_time?.slice(0,5)}</span>
              </div>
            ) : (
              <button className="btn-warning" onClick={doCheckOut} disabled={checkingOut}>
                {checkingOut ? 'Checking out…' : '⏹ Check out'}
              </button>
            )
          ) : (
            <button className="btn-success" onClick={doCheckIn} disabled={checking}>
              {checking ? 'Checking in…' : '▶ Check in now'}
            </button>
          )}
        </div>
      </header>

      <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Today's Status" value={<span className="inline-flex items-center gap-2"><span className="text-4xl">{presenceEmoji}</span>{stats?.present_today ? (stats.present_today.toUpperCase()) : 'NOT MARKED'}</span>}
          hint={todayAtt ? <>Check-in <b>{todayAtt.check_in_time?.slice(0,5) || '—'}</b> · Check-out <b>{todayAtt.check_out_time?.slice(0,5) || '—'}</b></> : 'Tap the button to the right to check in'}
          icon="🕘" tone="brand" />
        <StatCard title="Profile Completion" value={`${stats?.profile_completion_pct ?? 0}%`}
          hint="Complete your profile for payroll accuracy"
          icon="👤" tone="violet" action={<Link to="/profile" className="text-sm font-semibold text-brand-700 hover:underline">Complete profile →</Link>} />
        <StatCard title="Pending Leave Requests" value={stats?.pending_leave_requests ?? 0}
          hint={`${stats?.approved_leave_days_this_month ?? 0} day(s) approved this month`}
          icon="📝" tone="amber" action={<Link to="/leave" className="text-sm font-semibold text-brand-700 hover:underline">Apply leave →</Link>} />
        <StatCard title="Available Leave Balance" value={stats?.available_leave_balance ?? 0}
          hint={`${stats?.used_leave_days_this_year ?? 0} day(s) used this year`}
          icon="🏖️" tone="green" action={<Link to="/leave#balances" className="text-sm font-semibold text-brand-700 hover:underline">View balances →</Link>} />
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5">
            <div>
              <h3 className="font-bold text-slate-900">Your attendance — last 2 weeks</h3>
              <p className="text-sm text-slate-500">Rolling daily view with status</p>
            </div>
            <Link to="/attendance" className="text-sm font-semibold text-brand-700 hover:underline">Open Attendance →</Link>
          </div>
          <div className="p-5 overflow-x-auto">
            <div className="grid grid-cols-7 md:grid-cols-14 gap-2">
              {Array.from({ length: 14 }).map((_, i) => {
                const d = addDays(new Date(), -(13 - i))
                const rec = myAttendance.find((r) => r.attendance_date === yyyy_mm_dd(d))
                const s = rec?.status
                const colors = { present: 'bg-success-500', absent: 'bg-danger-500', half_day: 'bg-warning-500', leave: 'bg-brand-500' }
                const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' })
                const dayNum = d.getDate()
                return (
                  <div key={i} className="text-center">
                    <div className="text-[10px] text-slate-500 font-semibold">{dayName}</div>
                    <div className="mt-1 h-12 rounded-lg grid place-items-center text-xs font-bold text-white shadow-sm transition hover:scale-[1.03]"
                      style={{ background: rec ? colors[s] || '#cbd5e1' : '#e2e8f0' }}
                      title={rec ? `${s} · ${formatDate(d)}` : formatDate(d)}>
                      {rec ? dayNum : <span className="text-slate-500">{dayNum}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-4 text-xs text-slate-500 flex-wrap">
              {[
                ['bg-success-500', 'Present'], ['bg-warning-500', 'Half Day'],
                ['bg-brand-500', 'Leave'],   ['bg-danger-500', 'Absent'], ['bg-slate-200 text-slate-500', 'No data'],
              ].map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className={`inline-block w-3 h-3 rounded ${c.split(' ')[0]}`} />
                  <span className={c.split(' ')[1] || ''}>{l}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="px-5 pt-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Leave Balance</h3>
              <p className="text-sm text-slate-500">Current entitlements</p>
            </div>
            <Link to="/leave" className="text-sm font-semibold text-brand-700 hover:underline">All →</Link>
          </div>
          <ul className="divide-y divide-slate-100 mt-2">
            {balances.length === 0 && <li className="p-5 text-sm text-slate-500">No balance records yet.</li>}
            {balances.map((b) => {
              const avail = Number(b.available_days).toFixed(1)
              const entitled = Number(b.entitled_days + b.carry_forward_days).toFixed(1)
              const pct = entitled > 0 ? Math.min(100, (Number(avail) / Number(entitled)) * 100) : 0
              return (
                <li key={b.leave_balance_id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="capitalize font-semibold text-slate-800">{b.leave_type?.name || `Type ${b.leave_type_id}`}</div>
                    <div className="text-xs text-slate-500 font-semibold">{avail} / {entitled} days</div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-brand-700 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section className="card">
        <div className="px-5 pt-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Recent leave activity</h3>
            <p className="text-sm text-slate-500">Latest 5 leave requests</p>
          </div>
          <Link to="/leave" className="text-sm font-semibold text-brand-700 hover:underline">View all →</Link>
        </div>
        <div className="p-5">
          {recentLeaves.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">No leaves yet. Plan your time off by applying for leave 🎉</div>
          ) : (
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="table-head">
                  <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Applied</th>
                </tr>
              </thead>
              <tbody>
                {recentLeaves.map((r) => (
                  <tr key={r.leave_request_id} className="table-row">
                    <td className="capitalize font-semibold text-slate-800">{r.leave_type_name || r.leave_type_id}</td>
                    <td>{formatDate(r.start_date)}</td>
                    <td>{formatDate(r.end_date)}</td>
                    <td>{r.total_days}</td>
                    <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                    <td>{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="card bg-gradient-to-br from-brand-700 to-brand-900 text-white !border-0 overflow-hidden">
        <div className="relative p-6 grid md:grid-cols-2 gap-4 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-brand-200 font-semibold">Latest payroll · {stats?.latest_payroll_month || 'Pending'}</div>
            <h3 className="mt-1 text-2xl font-extrabold">Get instant answers from Dayflow AI</h3>
            <p className="mt-2 text-brand-100 text-sm max-w-md">
              Ask about your attendance, leave balance, latest salary, or anything HR-related. No menus, no clicks — just plain English.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/ai-assistant" className="btn bg-white text-brand-800 hover:bg-brand-50 shadow-card">Try AI Assistant →</Link>
              <Link to="/payroll" className="btn bg-white/10 border border-white/20 hover:bg-white/20 text-white">My Payroll</Link>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-4 text-sm font-mono space-y-2">
              <div><span className="text-brand-300">you →</span> "How many leaves do I have left?"</div>
              <div><span className="text-green-300">ai  →</span> Leave Balance: PAID 12.0, SICK 10.5, CASUAL 5.0</div>
              <div><span className="text-brand-300">you →</span> "Latest salary?"</div>
              <div><span className="text-green-300">ai  →</span> Net Salary: ₹1,89,320.00 · Month 08/2026</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
