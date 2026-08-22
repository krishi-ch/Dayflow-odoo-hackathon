import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import StatCard from '../components/StatCard.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatDate, statusBadge, yyyy_mm_dd, addDays } from '../utils/formatters.js'

export default function LeavePage() {
  const { user, isAdmin } = useAuth()
  const [types, setTypes] = useState([])
  const [balances, setBalances] = useState([])
  const [requests, setRequests] = useState([])
  const [pending, setPending] = useState([])
  const [tab, setTab] = useState('apply')
  const [adminFilter, setAdminFilter] = useState({ status: '', user_id: '', from: '', to: '' })
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: yyyy_mm_dd(addDays(new Date(), 1)),
    end_date: yyyy_mm_dd(addDays(new Date(), 2)),
    half_day_start: false, half_day_end: false,
    reason: '',
  })
  const [errors, setErrors] = useState({})

  const refreshApplyData = async () => {
    const [{ data: t }, { data: b }] = await Promise.all([
      api.get('/leave/types'),
      api.get('/leave/balances/my'),
    ])
    setTypes(t); setBalances(b)
    if (!form.leave_type_id && t[0]) {
      setForm((f) => ({ ...f, leave_type_id: String(t[0].leave_type_id) }))
    }
  }

  const refreshRequests = async () => {
    const [{ data: my }, { data: pnd }] = await Promise.all([
      api.get('/leave/my/requests', { params: { limit: 100 } }),
      isAdmin ? api.get('/leave/requests/pending') : Promise.resolve({ data: [] }),
    ])
    setRequests(my); setPending(pnd)
  }

  const refreshAdminAll = async () => {
    const params = {
      skip: 0, limit: 200,
      ...(adminFilter.status ? { status: adminFilter.status } : {}),
      ...(adminFilter.user_id ? { user_id: Number(adminFilter.user_id) } : {}),
      ...(adminFilter.from ? { start: adminFilter.from } : {}),
      ...(adminFilter.to ? { end: adminFilter.to } : {}),
    }
    const { data } = await api.get('/leave/requests/all', { params })
    setRequests(data)
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await refreshApplyData()
      await refreshRequests()
      setLoading(false)
    }
    init()
  }, [])
  useEffect(() => {
    if (tab === 'admin_all' && isAdmin) refreshAdminAll()
  }, [tab, adminFilter])

  const applySubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.leave_type_id) errs.leave_type_id = 'Please select leave type'
    if (!form.reason || form.reason.length < 5) errs.reason = 'Reason must be at least 5 characters'
    if (form.end_date < form.start_date) errs.end_date = 'End date must be ≥ start date'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const payload = { ...form, leave_type_id: Number(form.leave_type_id) }
    try {
      const { data } = await api.post('/leave/request', payload)
      toast.success(`Leave request #${data.leave_request_id} submitted ✅`)
      setForm({ ...form, reason: '' })
      refreshApplyData(); refreshRequests()
      setTab('history')
    } catch (e) { toast.error(extractError(e)) }
  }

  const act = async (r, action, comments) => {
    try {
      await api.post(`/leave/requests/${r.leave_request_id}/action`, { action, admin_comments: comments })
      toast.success(`Request #${r.leave_request_id} ${action}`)
      refreshRequests(); refreshAdminAll()
    } catch (e) { toast.error(extractError(e)) }
  }

  const quickApprove = (r) => act(r, 'approved', 'Approved — have a nice time!')
  const quickReject  = (r) => act(r, 'rejected',  'Rejected — please contact HR for details.')

  const balanceFor = (ltId) => balances.find((b) => b.leave_type_id === ltId)
  const computeDays = () => {
    if (!form.start_date || !form.end_date) return 0
    const s = new Date(form.start_date), e = new Date(form.end_date)
    let days = 0
    for (let d = new Date(s); d <= e; d = addDays(d, 1)) if (d.getDay() < 5) days += 1
    if (form.half_day_start) days -= 0.5
    if (form.half_day_end && s.getTime() !== e.getTime()) days -= 0.5
    return Math.max(days, 0.5)
  }
  const requestedDays = computeDays()
  const chosenBalance = balanceFor(Number(form.leave_type_id))

  return (
    <div className="space-y-6 animate-slideUp">
      <header>
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Time-off management</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Leave & Time Off</h1>
        <p className="mt-1 text-slate-500 text-sm">Apply for leave, view entitlements, and HR/Admin can approve in one click.</p>
      </header>

      <div className="card card-body flex flex-wrap items-center gap-3 p-3">
        <div className="flex rounded-xl bg-slate-100 p-1 flex-wrap">
          <button onClick={() => setTab('apply')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'apply' ? 'bg-white shadow-card text-slate-900' : 'text-slate-600'}`}>✏️ Apply</button>
          <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'history' ? 'bg-white shadow-card text-slate-900' : 'text-slate-600'}`}>📜 My History</button>
          {isAdmin && <button onClick={() => setTab('pending')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'pending' ? 'bg-white shadow-card text-slate-900' : 'text-slate-600'}`}>⏳ Pending Approvals <span className={`ml-1 badge ${pending.length ? 'badge-warning' : 'badge-muted'}`}>{pending.length}</span></button>}
          {isAdmin && <button onClick={() => setTab('admin_all')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'admin_all' ? 'bg-white shadow-card text-slate-900' : 'text-slate-600'}`}>🔎 All Requests</button>}
        </div>
        {tab === 'admin_all' && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select className="input !py-2" value={adminFilter.status} onChange={(e) => setAdminFilter((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
            <input type="date" className="input !py-2" placeholder="From" value={adminFilter.from}
              onChange={(e) => setAdminFilter((f) => ({ ...f, from: e.target.value }))} />
            <input type="date" className="input !py-2" placeholder="To" value={adminFilter.to}
              onChange={(e) => setAdminFilter((f) => ({ ...f, to: e.target.value }))} />
          </div>
        )}
      </div>

      <section id="balances" className="grid md:grid-cols-4 gap-4">
        <StatCard title="Leave Entitlements" value={balances.length} tone="brand" icon="🏖️" hint={`${new Date().getFullYear()} financial year`} />
        {balances.slice(0, 3).map((b) => (
          <StatCard key={b.leave_balance_id}
            title={String(b.leave_type?.name || `Type ${b.leave_type_id}`).toUpperCase()}
            value={`${Number(b.available_days).toFixed(1)}d`}
            tone="green"
            icon="📅"
            hint={`${Number(b.used_days).toFixed(1)} used · ${Number(b.entitled_days).toFixed(1)} entitled`}
          />
        ))}
      </section>

      {tab === 'apply' && (
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-2">
            <div className="px-5 pt-5">
              <h3 className="font-bold text-slate-900">New leave request</h3>
              <p className="text-sm text-slate-500">Weekends are excluded. Approvals are sent to HR / Admin instantly.</p>
            </div>
            <form onSubmit={applySubmit} className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Leave type</label>
                  <select className="input" value={form.leave_type_id}
                    onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}>
                    <option value="">— select —</option>
                    {types.map((t) => (
                      <option key={t.leave_type_id} value={t.leave_type_id}>
                        {String(t.name).toUpperCase()} — default {t.default_annual_quota} days{t.requires_proof ? ' · ⚠️ requires proof' : ''}
                      </option>
                    ))}
                  </select>
                  {errors.leave_type_id && <p className="text-xs text-danger-600 mt-1">{errors.leave_type_id}</p>}
                  {chosenBalance && (
                    <p className="text-xs mt-1 text-slate-500">
                      Your balance: <b className="text-slate-800">{Number(chosenBalance.available_days).toFixed(1)} days</b> available
                      {' · '}requesting <b className="text-brand-700">{requestedDays.toFixed(1)} days</b>
                      {(Number(requestedDays) > Number(chosenBalance.available_days) && chosenBalance.leave_type?.name !== 'unpaid') && (
                        <span className="ml-1 text-danger-600 font-semibold">(exceeds balance!)</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 items-end">
                  <div>
                    <label className="label">Start date</label>
                    <input type="date" className="input" value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">End date</label>
                    <input type="date" className="input" value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                    {errors.end_date && <p className="text-xs text-danger-600 mt-1">{errors.end_date}</p>}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
                  <input type="checkbox" className="w-4 h-4 accent-brand-600"
                    checked={form.half_day_start}
                    onChange={(e) => setForm({ ...form, half_day_start: e.target.checked })} />
                  Half day on <b>start</b> date
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
                  <input type="checkbox" className="w-4 h-4 accent-brand-600"
                    checked={form.half_day_end}
                    onChange={(e) => setForm({ ...form, half_day_end: e.target.checked })} />
                  Half day on <b>end</b> date
                </label>
              </div>

              <div>
                <label className="label">Reason / Remarks</label>
                <textarea className="input min-h-[100px]" value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Describe your reason for taking this leave..." />
                {errors.reason && <p className="text-xs text-danger-600 mt-1">{errors.reason}</p>}
              </div>

              <div className="flex items-center justify-end gap-2">
                <Link to="/leave" className="btn-outline" onClick={(e) => { e.preventDefault(); setTab('history'); }}>View history</Link>
                <button className="btn-primary px-6" type="submit">Submit leave request →</button>
              </div>
            </form>
          </div>

          <aside className="space-y-6">
            <div className="card card-body">
              <h4 className="font-bold text-slate-900">Balances · {new Date().getFullYear()}</h4>
              <ul className="mt-3 divide-y divide-slate-100">
                {balances.map((b) => (
                  <li key={b.leave_balance_id} className="py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="capitalize font-semibold text-slate-800">{String(b.leave_type?.name || 'type')}</span>
                      <span className="text-xs font-semibold text-slate-600">{Number(b.available_days).toFixed(1)} / {Number(b.entitled_days + b.carry_forward_days).toFixed(1)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-brand-700 rounded-full" style={{
                        width: `${Math.min(100, (Number(b.available_days) / Math.max(1, Number(b.entitled_days + b.carry_forward_days))) * 100)}%`
                      }} />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Used {Number(b.used_days).toFixed(1)} · Carry-forward {Number(b.carry_forward_days).toFixed(1)}</div>
                  </li>
                ))}
                {balances.length === 0 && <li className="text-sm text-slate-500 py-4">No leave balances yet.</li>}
              </ul>
            </div>
            <div className="card card-body bg-amber-50 border-amber-100">
              <h4 className="font-bold text-amber-900 flex items-center gap-2">⏰ Submission tips</h4>
              <ul className="mt-2 space-y-1 text-xs text-amber-900 list-disc list-inside">
                <li>Apply at least 3 working days ahead for planned leave</li>
                <li>Attach medical proof for Sick leave &gt; 2 days</li>
                <li>You'll receive a push notification once approved / rejected</li>
                <li>Unpaid leave doesn't deduct from balance</li>
              </ul>
            </div>
          </aside>
        </section>
      )}

      {(tab === 'history' || tab === 'admin_all') && (
        <section className="card">
          <div className="px-5 pt-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">{tab === 'history' ? 'My leave history' : 'All employee leave requests'}</h3>
              <p className="text-sm text-slate-500">{requests.length} records</p>
            </div>
            {tab === 'history' && <button className="btn-primary" onClick={() => setTab('apply')}>+ New request</button>}
          </div>
          <div className="p-5 overflow-x-auto">
            {loading ? (
              <LoadingSpinner full text="Loading leave data…" />
            ) : requests.length === 0 ? (
              <div className="py-10 text-sm text-slate-500 text-center bg-slate-50 rounded-xl">No records found.</div>
            ) : (
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="table-head">
                    <th>ID</th>
                    {tab !== 'history' && <th>Employee</th>}
                    <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th>
                    <th>Status</th><th>Comments</th><th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.leave_request_id} id={r.leave_request_id} className="table-row">
                      <td className="font-mono text-xs">#{r.leave_request_id}</td>
                      {tab !== 'history' && <td className="font-semibold text-slate-800">{r.employee_name || `User ${r.user_id}`}</td>}
                      <td className="capitalize font-semibold text-slate-800">{String(r.leave_type_name || r.leave_type_id).replace('_', ' ')}</td>
                      <td>{formatDate(r.start_date)}</td>
                      <td>{formatDate(r.end_date)}</td>
                      <td className="font-semibold">{r.total_days}</td>
                      <td className="max-w-[280px] truncate text-sm text-slate-600" title={r.reason}>{r.reason}</td>
                      <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                      <td className="max-w-[200px] truncate text-xs text-slate-500" title={r.admin_comments || ''}>{r.admin_comments || '—'}</td>
                      <td className="text-xs text-slate-500">{formatDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {tab === 'pending' && isAdmin && (
        <section className="space-y-4">
          {pending.length === 0 ? (
            <div className="card card-body py-12 text-center text-slate-500">🎉 All caught up — no pending approvals right now.</div>
          ) : (
            pending.map((r) => (
              <div key={r.leave_request_id} className="card card-body grid md:grid-cols-3 gap-4 items-center">
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-lg text-slate-900">{r.employee_name || `User ${r.user_id}`}</span>
                    <span className="badge-warning capitalize">{String(r.leave_type_name || '').replace('_', ' ')}</span>
                    <span className="badge-muted">#{r.leave_request_id}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    <b>{formatDate(r.start_date)}</b> — <b>{formatDate(r.end_date)}</b> · <b>{r.total_days}</b> day(s)
                  </div>
                  <div className="mt-1 text-sm text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">{r.reason}</div>
                </div>
                <div className="flex md:justify-end gap-2 flex-wrap">
                  <button className="btn-success" onClick={() => quickApprove(r)}>✓ Approve</button>
                  <button className="btn-danger" onClick={() => quickReject(r)}>✕ Reject</button>
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  )
}
