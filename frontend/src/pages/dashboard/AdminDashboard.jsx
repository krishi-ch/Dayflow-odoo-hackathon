import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { extractError } from '../../utils/api.js'
import { toast } from '../../components/Toast.jsx'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import StatCard from '../../components/StatCard.jsx'
import { formatDate, statusBadge, yyyy_mm_dd } from '../../utils/formatters.js'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [pendingLeaves, setPendingLeaves] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const currentYear = new Date().getFullYear()
  const [payroll, setPayroll] = useState({ month: new Date().getMonth() + 1, year: currentYear })

  const refreshAll = async () => {
    try {
      const [{ data: s }, { data: pl }, { data: ta }] = await Promise.all([
        api.get('/dashboard/admin'),
        api.get('/leave/requests/pending'),
        api.get('/attendance/all', { params: { date: yyyy_mm_dd() } }),
      ])
      setStats(s); setPendingLeaves(pl); setTodayAttendance(ta)
    } catch (e) { toast.error(extractError(e)) }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await refreshAll()
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return <LoadingSpinner full text="Loading admin dashboard…" />

  const attCounts = todayAttendance.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, { present: 0, absent: 0, half_day: 0, leave: 0 })

  const pie = [
    { name: 'Present', value: attCounts.present || 0, color: '#10b981' },
    { name: 'Half Day', value: attCounts.half_day || 0, color: '#f59e0b' },
    { name: 'Leave', value: attCounts.leave || 0, color: '#3b82f6' },
    { name: 'Absent', value: attCounts.absent || 0, color: '#ef4444' },
  ]

  const generatePayroll = async () => {
    try {
      const { data } = await api.post('/payroll/generate', payroll)
      toast.success(`Generated ${data.length} payroll record(s) ✅`)
      refreshAll()
    } catch (e) { toast.error(extractError(e)) }
  }

  const actionOnLeave = async (id, action, comments) => {
    try {
      await api.post(`/leave/requests/${id}/action`, { action, admin_comments: comments })
      toast.success(`Leave ${action === 'approved' ? 'approved' : 'rejected'}`)
      refreshAll()
    } catch (e) { toast.error(extractError(e)) }
  }

  return (
    <div className="space-y-6 animate-slideUp">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Admin / HR workspace</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Operations overview</h1>
          <p className="mt-1 text-slate-500 text-sm">Everything you need to approve, monitor and generate — today.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/admin/employees" className="btn-outline">🧑‍🤝‍🧑 Employees</Link>
          <Link to="/leave" className="btn-outline">🏖️ Leave Queue</Link>
          <div className="card-body !py-2 !px-3 flex items-center gap-2">
            <select className="!py-1.5 !px-2 text-sm input !w-auto"
              value={payroll.month} onChange={(e) => setPayroll((p) => ({ ...p, month: Number(e.target.value) }))}>
              {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' })}</option>)}
            </select>
            <select className="!py-1.5 !px-2 text-sm input !w-auto"
              value={payroll.year} onChange={(e) => setPayroll((p) => ({ ...p, year: Number(e.target.value) }))}>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => <option key={y}>{y}</option>)}
            </select>
            <button className={`!py-1.5 !px-3 btn ${stats?.payroll_generated_current_month && payroll.month === new Date().getMonth() + 1 ? 'btn-outline' : 'btn-primary'}`}
              onClick={generatePayroll}>
              {stats?.payroll_generated_current_month ? '🔁 Re-run Payroll' : '💰 Run Payroll'}
            </button>
          </div>
        </div>
      </header>

      <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Active Employees" value={stats?.active_employees ?? 0}
          hint={`Total ${stats?.total_employees ?? 0} employees registered`}
          icon="🧑‍🤝‍🧑" tone="brand"
          action={<Link to="/admin/employees" className="text-sm font-semibold text-brand-700 hover:underline">Open list →</Link>} />
        <StatCard title="Present Today" value={stats?.present_today ?? 0}
          hint={`Absent: ${stats?.absent_today ?? 0}`}
          icon="✅" tone="green"
          action={<Link to="/attendance" className="text-sm font-semibold text-brand-700 hover:underline">View today →</Link>} />
        <StatCard title="Pending Approvals" value={stats?.pending_leave_approvals ?? 0}
          hint="Leave requests awaiting action"
          icon="📝" tone="amber"
          action={<Link to="/leave" className="text-sm font-semibold text-brand-700 hover:underline">Approve now →</Link>} />
        <StatCard title="New joiners this month" value={stats?.new_employees_this_month ?? 0}
          hint={`${stats?.pending_verifications ?? 0} unverified accounts`}
          icon="🎉" tone="violet" />
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="px-5 pt-5">
            <h3 className="font-bold text-slate-900">Today's attendance by status</h3>
            <p className="text-sm text-slate-500">Distribution of {todayAttendance.length} records marked today</p>
          </div>
          <div className="h-72 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pie} margin={{ top: 16, right: 16, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {pie.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="px-5 pt-5">
            <h3 className="font-bold text-slate-900">Attendance distribution</h3>
            <p className="text-sm text-slate-500">Proportion of statuses</p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={55}>
                  {pie.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-5 grid grid-cols-2 gap-2 text-xs">
            {pie.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-slate-600 font-semibold">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="px-5 pt-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2">Pending leave approvals <span className={`ml-1 badge ${pendingLeaves.length ? 'badge-warning' : 'badge-muted'}`}>{pendingLeaves.length}</span></h3>
            <p className="text-sm text-slate-500">Approve or reject with one click — employees are notified instantly</p>
          </div>
          <Link to="/leave" className="text-sm font-semibold text-brand-700 hover:underline">Open Leave module →</Link>
        </div>
        <div className="p-5">
          {pendingLeaves.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center bg-slate-50 rounded-xl">
              🎉 All caught up! No pending leave approvals right now.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {pendingLeaves.slice(0, 8).map((r) => (
                <div key={r.leave_request_id} className="p-4 flex flex-wrap items-start md:items-center gap-4 hover:bg-slate-50 transition">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{r.employee_name || `User ${r.user_id}`}</span>
                      <span className="badge-info capitalize">{r.leave_type_name}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      <b>{formatDate(r.start_date)}</b> — <b>{formatDate(r.end_date)}</b> · <b>{r.total_days}</b> day(s)
                    </div>
                    <div className="mt-1 text-sm text-slate-500 line-clamp-1">{r.reason}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-success !py-2" onClick={() => actionOnLeave(r.leave_request_id, 'approved', 'Looks good, enjoy!')}>✓ Approve</button>
                    <button className="btn-danger !py-2" onClick={() => actionOnLeave(r.leave_request_id, 'rejected', 'Request rejected. Please check with HR.')}>✕ Reject</button>
                    <Link to={`/leave#${r.leave_request_id}`} className="btn-outline !py-2">Details</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-5 pt-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Live attendance today</h3>
              <p className="text-sm text-slate-500">Latest 10 records</p>
            </div>
            <Link to="/attendance" className="text-sm font-semibold text-brand-700 hover:underline">All records →</Link>
          </div>
          <div className="p-5">
            <table className="w-full min-w-[560px]">
              <thead><tr className="table-head"><th>Employee</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
              <tbody>
                {todayAttendance.slice(0, 10).map((r) => (
                  <tr key={r.attendance_id} className="table-row">
                    <td className="font-semibold text-slate-800">{r.employee_name || `User ${r.user_id}`}</td>
                    <td className="font-mono text-xs">{r.check_in_time?.slice(0,5) || '—'}</td>
                    <td className="font-mono text-xs">{r.check_out_time?.slice(0,5) || '—'}</td>
                    <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                  </tr>
                ))}
                {todayAttendance.length === 0 && (
                  <tr><td colSpan="4" className="text-sm text-slate-500 py-6 text-center">No attendance records yet today. Come back after employees check in.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-slate-900 to-slate-800 text-white !border-0">
          <div className="p-6">
            <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Data integrity · Audit-first</div>
            <h3 className="mt-1 text-2xl font-extrabold">Every sensitive action is logged</h3>
            <p className="mt-2 text-slate-300 text-sm">
              <b>13 PostgreSQL tables · 12 indexes · 4 triggers</b> keep data consistent.
              Every create/update/delete/approve/reject/login is captured in <code className="bg-white/10 px-1 rounded">audit_logs</code> with IP, timestamp and before/after values.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link to="/admin/audit" className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 p-4 transition">
                <div className="text-2xl">🛡️</div>
                <div className="font-bold mt-1">Audit Logs</div>
                <div className="text-xs text-slate-300">Trace every system action</div>
              </Link>
              <Link to="/payroll" className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 p-4 transition">
                <div className="text-2xl">📄</div>
                <div className="font-bold mt-1">Payroll + Payslips</div>
                <div className="text-xs text-slate-300">PDF & CSV export ready</div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
