import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatDate, statusBadge, yyyy_mm_dd, addDays } from '../utils/formatters.js'

function LeaveBalanceCards({ balances }) {
  if (!balances.length) return null
  return (
    <div className="grid md:grid-cols-4 gap-4">
      {balances.map((b) => {
        const available = Number(b.available_days ?? 0).toFixed(0)
        const entitled = (Number(b.entitled_days ?? 0) + Number(b.carry_forward_days ?? 0)).toFixed(0)
        return (
          <div key={b.leave_balance_id} className="card card-body !py-4 text-center">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              {String(b.leave_type?.name || 'Leave').replace('_', ' ')}
            </div>
            <div className="text-3xl font-extrabold text-brand-700 mt-1">{available}</div>
            <div className="text-xs text-slate-500 mt-0.5">Days Available</div>
          </div>
        )
      })}
    </div>
  )
}

function TimeOffRequestModal({ types, balances, onClose, onSubmit }) {
  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: yyyy_mm_dd(addDays(new Date(), 1)),
    end_date: yyyy_mm_dd(addDays(new Date(), 2)),
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.leave_type_id) { toast.warning('Select leave type'); return }
    if (!form.reason || form.reason.length < 5) { toast.warning('Reason must be at least 5 characters'); return }
    setSubmitting(true)
    try {
      await onSubmit({ ...form, leave_type_id: Number(form.leave_type_id) })
      onClose()
    } catch {}
    setSubmitting(false)
  }

  const chosenBalance = balances.find((b) => b.leave_type_id === Number(form.leave_type_id))

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg card animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 flex items-start justify-between">
          <h3 className="font-bold text-slate-900 text-xl">Time Off Type Request</h3>
          <button className="btn-ghost text-xl" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Employee</label>
            <div className="text-sm font-semibold text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              Current User
            </div>
          </div>
          <div>
            <label className="label">Time off Type</label>
            <select className="input" value={form.leave_type_id}
              onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}>
              <option value="">— select type —</option>
              {types.map((t) => (
                <option key={t.leave_type_id} value={t.leave_type_id}>
                  {String(t.name).replace('_', ' ')}{t.requires_proof ? ' (requires proof)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Validity From</label>
              <input type="date" className="input" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          {chosenBalance && (
            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
              Available: <b>{Number(chosenBalance.available_days).toFixed(1)} days</b>
            </div>
          )}
          <div>
            <label className="label">Reason / Remarks</label>
            <textarea className="input min-h-[80px]" value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Describe your reason..." />
          </div>
          <div>
            <label className="label">Attachment (for sick leave certificate)</label>
            <input type="file" className="input" accept=".pdf,.jpg,.png" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={onClose}>Discard</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmployeeTimeOffView({ types, balances, requests, refresh }) {
  const [showModal, setShowModal] = useState(false)

  const submitLeave = async (form) => {
    try {
      const { data } = await api.post('/leave/request', form)
      toast.success(`Leave request #${data.leave_request_id} submitted ✅`)
      refresh()
    } catch (e) { toast.error(extractError(e)); throw e }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ NEW</button>
      </div>
      <LeaveBalanceCards balances={balances} />

      {/* Calendar-style view */}
      <div className="card">
        <div className="px-5 pt-5">
          <h3 className="font-bold text-slate-900">My Time Off Calendar · {new Date().getFullYear()}</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => {
              const monthRequests = requests.filter((r) => {
                const d = new Date(r.start_date)
                return d.getMonth() === i && d.getFullYear() === new Date().getFullYear()
              })
              return (
                <div key={i} className="border border-slate-100 rounded-xl p-3 text-center">
                  <div className="text-xs font-bold text-slate-700 mb-2">
                    {new Date(2000, i, 1).toLocaleString('en-US', { month: 'short' })}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: new Date(new Date().getFullYear(), i + 1, 0).getDate() }).map((_, d) => {
                      const dateStr = yyyy_mm_dd(new Date(new Date().getFullYear(), i, d + 1))
                      const hasLeave = monthRequests.some((r) => {
                        const start = r.start_date?.slice(0, 10)
                        const end = r.end_date?.slice(0, 10)
                        return dateStr >= start && dateStr <= end
                      })
                      return (
                        <div
                          key={d}
                          className={`w-5 h-5 text-[9px] rounded grid place-items-center ${hasLeave ? 'bg-brand-500 text-white font-bold' : 'text-slate-600'}`}
                        >
                          {d + 1}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Leave History */}
      <div className="card">
        <div className="px-5 pt-5 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">My Leave History</h3>
          <span className="badge-muted">{requests.length} records</span>
        </div>
        <div className="p-5 overflow-x-auto">
          {requests.length === 0 ? (
            <div className="py-8 text-sm text-slate-500 text-center">No leave requests yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="table-head">
                  <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.leave_request_id} className="table-row">
                    <td className="capitalize font-semibold text-slate-800">{String(r.leave_type_name || r.leave_type_id).replace('_', ' ')}</td>
                    <td>{formatDate(r.start_date)}</td>
                    <td>{formatDate(r.end_date)}</td>
                    <td className="font-semibold">{r.total_days}</td>
                    <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                    <td className="text-sm text-slate-500">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <TimeOffRequestModal
          types={types}
          balances={balances}
          onClose={() => setShowModal(false)}
          onSubmit={submitLeave}
        />
      )}
    </div>
  )
}

function AdminTimeOffView({ types, balances, requests, pending, allRequests, refresh, filter, setFilter }) {
  const [showModal, setShowModal] = useState(false)

  const submitLeave = async (form) => {
    try {
      const { data } = await api.post('/leave/request', form)
      toast.success(`Leave request #${data.leave_request_id} submitted ✅`)
      refresh()
    } catch (e) { toast.error(extractError(e)); throw e }
  }

  const act = async (r, action) => {
    try {
      await api.post(`/leave/requests/${r.leave_request_id}/action`, {
        action,
        admin_comments: action === 'approved' ? 'Approved' : 'Rejected — please contact HR',
      })
      toast.success(`Request #${r.leave_request_id} ${action}`)
      refresh()
    } catch (e) { toast.error(extractError(e)) }
  }

  return (
    <div className="space-y-6">
      {/* Leave Balances */}
      <div className="flex items-center justify-end">
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ NEW</button>
      </div>
      <LeaveBalanceCards balances={balances} />

      {/* Search */}
      <div className="card card-body !py-3 !px-4">
        <input
          className="input md:w-80"
          placeholder="🔍 Search employee name..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
        />
      </div>

      {/* All Requests Table */}
      <div className="card">
        <div className="px-5 pt-5 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">All Time Off Requests</h3>
          <span className="badge-muted">{allRequests.length} records</span>
        </div>
        <div className="p-5 overflow-x-auto">
          {allRequests.length === 0 ? (
            <div className="py-8 text-sm text-slate-500 text-center">No requests found.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="table-head">
                  <th>Name</th><th>Start Date</th><th>End Date</th><th>Type</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allRequests.map((r) => (
                  <tr key={r.leave_request_id} className="table-row">
                    <td className="font-semibold text-slate-800">{r.employee_name || `User ${r.user_id}`}</td>
                    <td>{formatDate(r.start_date)}</td>
                    <td>{formatDate(r.end_date)}</td>
                    <td className="capitalize">{String(r.leave_type_name || '').replace('_', ' ')}</td>
                    <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="flex gap-1">
                          <button className="btn-success !py-1 !px-2 text-xs" onClick={() => act(r, 'approved')}>✓ Approve</button>
                          <button className="btn-danger !py-1 !px-2 text-xs" onClick={() => act(r, 'rejected')}>✕ Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <TimeOffRequestModal
          types={types}
          balances={balances}
          onClose={() => setShowModal(false)}
          onSubmit={submitLeave}
        />
      )}
    </div>
  )
}

export default function LeavePage() {
  const { isAdmin } = useAuth()
  const [types, setTypes] = useState([])
  const [balances, setBalances] = useState([])
  const [requests, setRequests] = useState([])
  const [pending, setPending] = useState([])
  const [allRequests, setAllRequests] = useState([])
  const [filter, setFilter] = useState({ search: '' })
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const [{ data: t }, { data: b }, { data: my }] = await Promise.all([
        api.get('/leave/types'),
        api.get('/leave/balances/my'),
        api.get('/leave/my/requests', { params: { limit: 100 } }),
      ])
      setTypes(t)
      setBalances(b)
      setRequests(my)

      if (isAdmin) {
        const [{ data: pnd }, { data: all }] = await Promise.all([
          api.get('/leave/requests/pending'),
          api.get('/leave/requests/all', { params: { skip: 0, limit: 200 } }),
        ])
        setPending(pnd)
        setAllRequests(all)
      }
    } catch (e) { toast.error(extractError(e)) }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await refresh()
      setLoading(false)
    }
    init()
  }, [isAdmin])

  if (loading) return <LoadingSpinner full text="Loading leave data…" />

  return (
    <div className="space-y-6 animate-slideUp">
      <header>
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Time Off</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Time Off</h1>
      </header>

      {isAdmin ? (
        <AdminTimeOffView
          types={types}
          balances={balances}
          requests={requests}
          pending={pending}
          allRequests={allRequests}
          refresh={refresh}
          filter={filter}
          setFilter={setFilter}
        />
      ) : (
        <EmployeeTimeOffView
          types={types}
          balances={balances}
          requests={requests}
          refresh={refresh}
        />
      )}
    </div>
  )
}
