import React, { useEffect, useState } from 'react'
import api, { extractError } from '../../utils/api.js'
import { toast } from '../../components/Toast.jsx'
import { formatDateTime, statusBadge } from '../../utils/formatters.js'

const ACTIONS = ['', 'create', 'update', 'delete', 'approve', 'reject', 'login', 'logout']
const TABLES = ['', 'users', 'employee_profiles', 'leave_requests', 'leave_balances', 'attendance_records',
  'salary_structures', 'payroll_records', 'notifications', 'audit_logs']

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState({ table: '', action: '', user_id: '' })
  const [users, setUsers] = useState([])

  const load = async () => {
    try {
      const params = { limit: 500, ...filter }
      Object.keys(params).forEach((k) => { if (!params[k] || params[k] === '') delete params[k] })
      const [{ data: logsData }, { data: usersData }] = await Promise.all([
        api.get('/audit-logs', { params }),
        api.get('/employees', { params: { limit: 500 } }),
      ])
      setLogs(logsData); setUsers(usersData)
    } catch (e) { toast.error(extractError(e)) }
  }

  useEffect(() => { load() }, [filter])

  const userFor = (uid) => users.find((u) => u.user_id === uid)

  return (
    <div className="space-y-6 animate-slideUp">
      <header>
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Security & compliance</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Audit logs</h1>
        <p className="mt-1 text-slate-500 text-sm">
          Immutable audit trail of every sensitive action performed on Dayflow — create/update/delete/approve/reject/login/logout — with IP, timestamp and before/after values.
        </p>
      </header>

      <section className="card">
        <div className="p-4 md:p-5 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <select className="input md:w-48" value={filter.action}
            onChange={(e) => setFilter({ ...filter, action: e.target.value })}>
            {ACTIONS.map((a) => <option key={a} value={a}>{a ? `Action: ${a}` : 'All actions'}</option>)}
          </select>
          <select className="input md:w-60" value={filter.table}
            onChange={(e) => setFilter({ ...filter, table: e.target.value })}>
            {TABLES.map((t) => <option key={t} value={t}>{t ? `Table: ${t}` : 'All tables'}</option>)}
          </select>
          <span className="badge-muted">{logs.length} records (top 500)</span>
        </div>
        <div className="overflow-x-auto">
          {logs.length === 0 ? (
            <div className="py-14 text-center text-slate-500 text-sm">No logs yet. Perform some actions in other modules to see events appear here.</div>
          ) : (
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="table-head">
                  <th>When</th><th>Actor</th><th>Action</th>
                  <th>Table</th><th>Record #</th><th>IP Address</th>
                  <th>Old values</th><th>New values</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const u = userFor(l.user_id)
                  return (
                    <tr key={l.log_id} className="table-row align-top">
                      <td className="whitespace-nowrap text-xs text-slate-600">{formatDateTime(l.timestamp)}</td>
                      <td>
                        <div className="font-semibold text-slate-800 text-sm">
                          {u ? `${u.first_name} ${u.last_name}` : l.user_name || `User #${l.user_id}`}
                        </div>
                        {u && <div className="text-[11px] text-slate-500">{u.job_title} · {u.department}</div>}
                      </td>
                      <td><span className={statusBadge(l.action)}>{l.action}</span></td>
                      <td className="font-mono text-xs text-slate-600">{l.table_name || '—'}</td>
                      <td className="font-mono text-xs text-slate-600">#{l.record_id || '—'}</td>
                      <td className="font-mono text-xs text-slate-600">{l.ip_address || '—'}</td>
                      <td className="max-w-[280px]">
                        {l.old_values && Object.keys(l.old_values).length ? (
                          <details className="text-xs">
                            <summary className="cursor-pointer hover:text-brand-700 font-medium text-slate-500">show {Object.keys(l.old_values).length} fields</summary>
                            <pre className="mt-1 p-2 rounded-lg bg-slate-50 border border-slate-100 overflow-auto max-h-32">{JSON.stringify(l.old_values, null, 2)}</pre>
                          </details>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="max-w-[280px]">
                        {l.new_values && Object.keys(l.new_values).length ? (
                          <details className="text-xs">
                            <summary className="cursor-pointer hover:text-brand-700 font-medium text-slate-500">show {Object.keys(l.new_values).length} fields</summary>
                            <pre className="mt-1 p-2 rounded-lg bg-green-50 border border-green-100 overflow-auto max-h-32">{JSON.stringify(l.new_values, null, 2)}</pre>
                          </details>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
