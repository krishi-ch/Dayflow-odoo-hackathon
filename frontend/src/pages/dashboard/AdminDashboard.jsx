import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api, { extractError } from '../../utils/api.js'
import { toast } from '../../components/Toast.jsx'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import Avatar from '../../components/Avatar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate, yyyy_mm_dd } from '../../utils/formatters.js'

function StatusDot({ status }) {
  const colors = {
    present: 'bg-success-500',
    half_day: 'bg-warning-500',
    leave: 'bg-danger-500',
    absent: 'bg-warning-500',
  }
  const labels = {
    present: 'Present',
    half_day: 'Half Day',
    leave: 'On Leave',
    absent: 'Absent',
  }
  return (
    <div className="flex items-center gap-1.5" title={labels[status] || status}>
      <span className={`inline-block w-3 h-3 rounded-full ${colors[status] || 'bg-slate-300'} ring-2 ring-white shadow-sm`} />
    </div>
  )
}

function EmployeeCard({ employee, onClick }) {
  const profile = employee.profile
  const attStatus = employee.attendance_status || 'absent'

  return (
    <button
      onClick={() => onClick?.(employee)}
      className="card p-4 text-left hover:shadow-pop hover:border-brand-200 transition-all cursor-pointer group relative"
    >
      <div className="absolute top-3 right-3">
        <StatusDot status={attStatus} />
      </div>
      <div className="flex flex-col items-center text-center">
        <div className="mb-3">
          <Avatar
            size="lg"
            user={{ employee_id: employee.employee_id, role: employee.role }}
            profile={profile}
          />
        </div>
        <div className="font-bold text-slate-900 text-sm group-hover:text-brand-700 transition">
          {profile ? `${profile.first_name} ${profile.last_name}` : employee.email?.split('@')[0]}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {profile?.job_title || '—'}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 font-mono">
          {employee.employee_id}
        </div>
      </div>
    </button>
  )
}

function EmployeeDetailModal({ employee, onClose, onLeaveAction, pendingLeaves }) {
  if (!employee) return null
  const profile = employee.profile
  const empLeaves = pendingLeaves?.filter((l) => l.user_id === employee.user_id) || []

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg card animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar size="lg" user={employee} profile={profile} />
            <div>
              <h3 className="font-extrabold text-xl text-slate-900">
                {profile ? `${profile.first_name} ${profile.last_name}` : employee.email}
              </h3>
              <div className="text-sm text-slate-500">{profile?.job_title || '—'}</div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">{employee.employee_id}</div>
            </div>
          </div>
          <button className="btn-ghost text-xl" onClick={onClose}>✕</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-slate-500">Email</span><div className="font-semibold text-slate-800">{employee.email}</div></div>
          <div><span className="text-slate-500">Phone</span><div className="font-semibold text-slate-800">{profile?.phone || '—'}</div></div>
          <div><span className="text-slate-500">Department</span><div className="font-semibold text-slate-800">{profile?.department || '—'}</div></div>
          <div><span className="text-slate-500">Location</span><div className="font-semibold text-slate-800">{profile?.work_location || '—'}</div></div>
          <div><span className="text-slate-500">Joining Date</span><div className="font-semibold text-slate-800">{formatDate(profile?.joining_date)}</div></div>
          <div><span className="text-slate-500">Employment</span><div className="font-semibold text-slate-800">{profile?.employment_type || '—'}</div></div>
        </div>

        {empLeaves.length > 0 && (
          <div className="px-5 pb-4">
            <div className="text-xs font-bold uppercase text-slate-500 mb-2">Pending Leave Requests</div>
            {empLeaves.map((l) => (
              <div key={l.leave_request_id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 mb-2 text-sm">
                <div>
                  <span className="font-semibold">{l.leave_type_name}</span> · {formatDate(l.start_date)} — {formatDate(l.end_date)} · {l.total_days}d
                </div>
                <div className="flex gap-1">
                  <button className="btn-success !py-1 !px-2 text-xs" onClick={() => onLeaveAction(l.leave_request_id, 'approved', 'Approved')}>✓</button>
                  <button className="btn-danger !py-1 !px-2 text-xs" onClick={() => onLeaveAction(l.leave_request_id, 'rejected', 'Rejected')}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 pb-5 flex justify-end gap-2">
          <Link to={`/admin/employees`} className="btn-outline text-sm">Employee list →</Link>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [pendingLeaves, setPendingLeaves] = useState([])
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedEmp, setSelectedEmp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState([])
  const currentYear = new Date().getFullYear()

  const loadDashboard = useCallback(async () => {
    try {
      const [{ data: emps }, { data: pl }, { data: st }] = await Promise.all([
        api.get('/dashboard/employees'),
        api.get('/leave/requests/pending').catch(() => ({ data: [] })),
        api.get('/dashboard/admin').catch(() => ({ data: {} })),
      ])
      // Merge attendance status into employees
      const attMap = {}
      try {
        const { data: allAtt } = await api.get('/attendance/all', {
          params: { date: yyyy_mm_dd() }
        })
        allAtt.forEach((r) => { attMap[r.user_id] = r.status })
      } catch {}

      const enriched = emps.map((e) => ({
        ...e,
        attendance_status: attMap[e.user_id] || 'absent',
      }))
      setEmployees(enriched)
      setPendingLeaves(pl)
      setStats(st)

      // Fetch recent activity from audit logs
      try {
        const { data: logs } = await api.get('/audit-logs', { params: { limit: 8 } })
        setActivity(logs)
      } catch {}
    } catch (e) {
      toast.error(extractError(e, 'Failed to load admin dashboard'))
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

  const actionOnLeave = async (id, action, comments) => {
    try {
      await api.post(`/leave/requests/${id}/action`, { action, admin_comments: comments })
      toast.success(`Leave ${action === 'approved' ? 'approved' : 'rejected'}`)
      setSelectedEmp(null)
      loadDashboard()
    } catch (e) { toast.error(extractError(e)) }
  }

  const filtered = employees.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = e.profile ? `${e.profile.first_name} ${e.profile.last_name}`.toLowerCase() : ''
    return name.includes(q) || e.employee_id?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q)
  })

  if (loading) return <LoadingSpinner full text="Loading admin dashboard…" />

  // Attendance summary
  const presentCount = employees.filter((e) => e.attendance_status === 'present' || e.attendance_status === 'half_day').length
  const leaveCount = employees.filter((e) => e.attendance_status === 'leave').length
  const absentCount = employees.filter((e) => e.attendance_status === 'absent').length

  return (
    <div className="space-y-6 animate-slideUp">
      {/* Header with Quick Stats */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Admin / HR</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Team Overview</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Attendance summary pills */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success-50 text-success-700 border border-success-100">
              <span className="w-2 h-2 rounded-full bg-success-500" />
              {presentCount} Present
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
              <span className="w-2 h-2 rounded-full bg-danger-500" />
              {leaveCount} On Leave
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              <span className="w-2 h-2 rounded-full bg-warning-500" />
              {absentCount} Absent
            </span>
          </div>
          {pendingLeaves.length > 0 && (
            <Link to="/leave" className="btn-warning text-sm">
              📝 {pendingLeaves.length} Pending
            </Link>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          className="input pl-10"
          placeholder="Search employees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filtered.map((emp) => (
          <EmployeeCard
            key={emp.user_id}
            employee={emp}
            onClick={setSelectedEmp}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            {search ? 'No employees match your search.' : 'No employees found.'}
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      {activity.length > 0 && (
        <div className="card">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Recent Activity</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Latest actions across the system</p>
            </div>
            <Link to="/admin/employees" className="text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">View all →</Link>
          </div>
          <div className="px-5 pb-5">
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-0">
                {activity.map((log, i) => (
                  <div key={log.audit_log_id || i} className="relative flex items-start gap-4 py-3">
                    <div className="relative z-10 w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/50 border-2 border-brand-300 dark:border-brand-700 grid place-items-center shrink-0 mt-0.5">
                      <span className="text-[10px]">
                        {log.action === 'create' ? '✨' : log.action === 'update' ? '✏️' : log.action === 'delete' ? '🗑️' : '📋'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-800 dark:text-slate-200">
                        <span className="font-semibold">{log.user_name || 'System'}</span>
                        {' '}{log.action === 'create' ? 'created' : log.action === 'update' ? 'updated' : log.action === 'delete' ? 'deleted' : log.action}{' '}
                        <span className="font-medium text-brand-700 dark:text-brand-400">{log.table_name}</span>
                        {log.record_id && <span className="text-slate-400 dark:text-slate-500 ml-1">#{log.record_id}</span>}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {log.timestamp && new Date(log.timestamp).toLocaleString()} {log.ip_address && `· ${log.ip_address}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Detail Modal */}
      <EmployeeDetailModal
        employee={selectedEmp}
        onClose={() => setSelectedEmp(null)}
        onLeaveAction={actionOnLeave}
        pendingLeaves={pendingLeaves}
      />
    </div>
  )
}
