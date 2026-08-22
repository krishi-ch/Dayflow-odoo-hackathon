import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api, { extractError } from '../../utils/api.js'
import { toast } from '../../components/Toast.jsx'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import Avatar from '../../components/Avatar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate, yyyy_mm_dd, addDays, statusBadge } from '../../utils/formatters.js'

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [todayAtt, setTodayAtt] = useState(null)
  const [stats, setStats] = useState(null)
  const [balances, setBalances] = useState([])
  const [recentAtt, setRecentAtt] = useState([])
  const [recentLeaves, setRecentLeaves] = useState([])
  const [checking, setChecking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(null)

  const loadDashboard = useCallback(async () => {
    try {
      const [profRes, attRes, statsRes, balRes, recAttRes, leavesRes] = await Promise.all([
        api.get('/employees/me').catch(() => ({ data: null })),
        api.get('/attendance/today').catch(() => ({ data: null })),
        api.get('/dashboard/employee').catch(() => ({ data: {} })),
        api.get('/leave/balances/my').catch(() => ({ data: [] })),
        api.get('/attendance/my/daily', {
          params: {
            start_date: yyyy_mm_dd(addDays(new Date(), -13)),
            end_date: yyyy_mm_dd(),
          }
        }).catch(() => ({ data: [] })),
        api.get('/leave/my/requests', { params: { limit: 5 } }).catch(() => ({ data: [] })),
      ])
      setProfile(profRes.data)
      setTodayAtt(attRes.data)
      setStats(statsRes.data)
      setBalances(balRes.data)
      setRecentAtt(recAttRes.data)
      setRecentLeaves(leavesRes.data)
    } catch (e) {
      toast.error(extractError(e, 'Failed to load dashboard'))
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadDashboard()
      setLoading(false)
    }
    init()
  }, [loadDashboard])

  // Elapsed timer for check-in
  useEffect(() => {
    if (!todayAtt?.check_in_time || todayAtt?.check_out_time) {
      setElapsed(null)
      return
    }
    const checkInTime = new Date()
    const [h, m] = todayAtt.check_in_time.split(':').map(Number)
    checkInTime.setHours(h, m, 0, 0)
    if (checkInTime > new Date()) checkInTime.setDate(checkInTime.getDate() - 1)

    const update = () => {
      const diff = Date.now() - checkInTime.getTime()
      const hrs = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setElapsed(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [todayAtt])

  const doCheckIn = async () => {
    setChecking(true)
    try {
      const { data } = await api.post('/attendance/check-in', {})
      setTodayAtt(data)
      toast.success(`Checked in at ${data.check_in_time?.slice(0, 5)} 🎉`)
      loadDashboard()
    } catch (e) { toast.error(extractError(e)) }
    finally { setChecking(false) }
  }

  const doCheckOut = async () => {
    setChecking(true)
    try {
      const { data } = await api.post('/attendance/check-out', {})
      setTodayAtt(data)
      toast.success(`Checked out at ${data.check_out_time?.slice(0, 5)}. Have a nice evening! 🌙`)
      setElapsed(null)
      loadDashboard()
    } catch (e) { toast.error(extractError(e)) }
    finally { setChecking(false) }
  }

  if (loading) return <LoadingSpinner full text="Loading dashboard…" />

  const isCheckIn = todayAtt && !todayAtt.check_out_time
  const isCheckedOut = todayAtt?.check_out_time
  const notCheckedIn = !todayAtt

  return (
    <div className="space-y-6 animate-slideUp">
      {/* Profile Card + Check In/Out */}
      <div className="card overflow-hidden">
        <div className="h-20 bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900" />
        <div className="px-5 pb-5 -mt-8 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="ring-4 ring-white rounded-full">
              <Avatar size="xl" user={user} profile={profile} showText={false} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold text-slate-900">
                {profile ? `${profile.first_name} ${profile.last_name}` : user?.employee_id}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
                <span className="font-mono">{user?.employee_id}</span>
                <span>·</span>
                <span>{profile?.job_title || 'Employee'}</span>
                <span>·</span>
                <span>{profile?.department || '—'}</span>
              </div>
            </div>
            <div className="card card-body !py-3 !px-5 flex items-center gap-4">
              {isCheckIn && elapsed && (
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Time</div>
                  <div className="text-xl font-extrabold font-mono text-brand-700">{elapsed}</div>
                </div>
              )}
              {notCheckedIn && (
                <button className="btn-success flex items-center gap-2" onClick={doCheckIn} disabled={checking}>
                  Check IN →
                </button>
              )}
              {isCheckIn && (
                <button className="btn-warning flex items-center gap-2" onClick={doCheckOut} disabled={checking}>
                  Check Out →
                </button>
              )}
              {isCheckedOut && (
                <div className="text-sm text-slate-500">
                  Checked out at <span className="font-bold text-slate-800">{todayAtt.check_out_time?.slice(0,5)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card card-body text-center !py-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Today's Status</div>
          <div className="text-2xl font-extrabold mt-1">
            {todayAtt ? (
              <span className={todayAtt.status === 'present' ? 'text-success-600' : todayAtt.status === 'leave' ? 'text-danger-600' : 'text-warning-600'}>
                {todayAtt.status?.toUpperCase()}
              </span>
            ) : (
              <span className="text-slate-400">NOT MARKED</span>
            )}
          </div>
          {todayAtt?.check_in_time && (
            <div className="text-xs text-slate-500 mt-1">In: {todayAtt.check_in_time?.slice(0,5)} · Out: {todayAtt.check_out_time?.slice(0,5) || '—'}</div>
          )}
        </div>
        <div className="card card-body text-center !py-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Profile</div>
          <div className="text-2xl font-extrabold text-brand-700 mt-1">{stats?.profile_completion_pct ?? 0}%</div>
          <Link to="/profile" className="text-xs text-brand-600 hover:underline mt-1">Complete →</Link>
        </div>
        <div className="card card-body text-center !py-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Pending Leave</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{stats?.pending_leave_requests ?? 0}</div>
          <Link to="/leave" className="text-xs text-brand-600 hover:underline mt-1">Apply leave →</Link>
        </div>
        <div className="card card-body text-center !py-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Leave Balance</div>
          <div className="text-2xl font-extrabold text-success-600 mt-1">{stats?.available_leave_balance ?? 0}d</div>
          <Link to="/leave" className="text-xs text-brand-600 hover:underline mt-1">View all →</Link>
        </div>
      </div>

      {/* Two columns: Attendance + Leave Balance */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Attendance */}
        <div className="card lg:col-span-2">
          <div className="px-5 pt-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Your attendance — last 2 weeks</h3>
              <p className="text-sm text-slate-500">Daily check-in/out status</p>
            </div>
            <Link to="/attendance" className="text-sm font-semibold text-brand-700 hover:underline">Open →</Link>
          </div>
          <div className="p-5 overflow-x-auto">
            {recentAtt.length === 0 ? (
              <div className="text-sm text-slate-500 py-6 text-center">No attendance records yet.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="table-head">
                    <th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAtt.slice(-7).reverse().map((r) => (
                    <tr key={r.attendance_id} className="table-row">
                      <td className="font-semibold text-slate-800">{formatDate(r.attendance_date)}</td>
                      <td className="font-mono text-xs">{r.check_in_time?.slice(0,5) || '—'}</td>
                      <td className="font-mono text-xs">{r.check_out_time?.slice(0,5) || '—'}</td>
                      <td>{r.work_duration_minutes ? `${(r.work_duration_minutes/60).toFixed(1)}h` : '—'}</td>
                      <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Leave Balance */}
        <div className="card">
          <div className="px-5 pt-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Leave Balance</h3>
              <p className="text-sm text-slate-500">{new Date().getFullYear()} entitlements</p>
            </div>
            <Link to="/leave" className="text-sm font-semibold text-brand-700 hover:underline">All →</Link>
          </div>
          <ul className="divide-y divide-slate-100 mt-2">
            {balances.length === 0 && <li className="p-5 text-sm text-slate-500">No balance records yet.</li>}
            {balances.map((b) => {
              const avail = Number(b.available_days ?? 0).toFixed(1)
              const entitled = (Number(b.entitled_days ?? 0) + Number(b.carry_forward_days ?? 0)).toFixed(1)
              const entitledNum = Number(entitled)
              const pct = entitledNum > 0 ? Math.min(100, (Number(avail) / entitledNum) * 100) : 0
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
      </div>

      {/* Recent Leave Activity */}
      {recentLeaves.length > 0 && (
        <div className="card">
          <div className="px-5 pt-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Recent leave activity</h3>
              <p className="text-sm text-slate-500">Latest 5 leave requests</p>
            </div>
            <Link to="/leave" className="text-sm font-semibold text-brand-700 hover:underline">View all →</Link>
          </div>
          <div className="p-5 overflow-x-auto">
            <table className="w-full">
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
                    <td className="text-sm text-slate-500">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
