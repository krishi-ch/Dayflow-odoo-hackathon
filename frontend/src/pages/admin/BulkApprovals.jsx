import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api, { extractError } from '../../utils/api.js'
import { toast } from '../../components/Toast.jsx'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import Avatar from '../../components/Avatar.jsx'
import { formatDate } from '../../utils/formatters.js'

export default function BulkApprovals() {
  const [requests, setRequests] = useState([])
  const [allRequests, setAllRequests] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [filter, setFilter] = useState('pending')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/leave/requests/all', { params: { limit: 200 } })
      const all = data || []
      setAllRequests(all)
      setRequests(filter === 'all' ? all : all.filter((r) => r.status === filter))
    } catch (e) {
      toast.error(extractError(e, 'Failed to load leave requests'))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === requests.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(requests.map((r) => r.leave_request_id)))
    }
  }

  const bulkAction = async (action) => {
    if (selected.size === 0) { toast.warning('Select at least one request'); return }
    setActing(true)
    try {
      const ids = Array.from(selected)
      const results = await Promise.allSettled(
        ids.map((id) => api.post(`/leave/requests/${id}/action`, { action, admin_comments: `Bulk ${action}` }))
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      if (succeeded) toast.success(`${succeeded} request(s) ${action === 'approved' ? 'approved' : 'rejected'} ✅`)
      if (failed) toast.error(`${failed} request(s) failed`)
      setSelected(new Set())
      load()
    } catch (e) {
      toast.error(extractError(e))
    } finally {
      setActing(false)
    }
  }

  const singleAction = async (id, action) => {
    try {
      await api.post(`/leave/requests/${id}/action`, { action, admin_comments: action })
      toast.success(`Request ${action === 'approved' ? 'approved' : 'rejected'}`)
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
      load()
    } catch (e) {
      toast.error(extractError(e))
    }
  }

  if (loading) return <LoadingSpinner full text="Loading leave requests…" />

  const statusCounts = {
    pending: allRequests.filter((r) => r.status === 'pending').length,
    approved: allRequests.filter((r) => r.status === 'approved').length,
    rejected: allRequests.filter((r) => r.status === 'rejected').length,
  }

  return (
    <div className="space-y-6 animate-slideUp">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">Bulk Operations</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Leave Approvals</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">Select multiple requests and approve or reject in one click</p>
        </div>
      </div>

      {/* Filter Tabs + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {[
            { key: 'pending', label: 'Pending', count: statusCounts.pending, color: 'amber' },
            { key: 'approved', label: 'Approved', count: statusCounts.approved, color: 'green' },
            { key: 'rejected', label: 'Rejected', count: statusCounts.rejected, color: 'red' },
            { key: 'all', label: 'All', count: allRequests.length, color: 'slate' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setSelected(new Set()) }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filter === tab.key
                  ? `bg-${tab.color}-100 dark:bg-${tab.color}-900/30 text-${tab.color}-700 dark:text-${tab.color}-400 ring-1 ring-${tab.color}-300`
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Bulk Actions */}
        {filter === 'pending' && selected.size > 0 && (
          <div className="flex items-center gap-2 animate-slideUp">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{selected.size} selected</span>
            <button onClick={() => bulkAction('approved')} disabled={acting} className="btn-success text-sm">
              ✓ Approve All
            </button>
            <button onClick={() => bulkAction('rejected')} disabled={acting} className="btn-danger text-sm">
              ✕ Reject All
            </button>
          </div>
        )}
      </div>

      {/* Select All */}
      {filter === 'pending' && requests.length > 0 && (
        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-5 h-5 rounded accent-brand-600"
            checked={selected.size === requests.length && requests.length > 0}
            onChange={toggleAll}
          />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Select all {requests.length} pending requests
          </span>
        </label>
      )}

      {/* Request List */}
      <div className="space-y-2">
        {requests.length === 0 ? (
          <div className="card card-body text-center py-16">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">All clear!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No {filter} leave requests to show.</p>
          </div>
        ) : (
          requests.map((r) => (
            <div
              key={r.leave_request_id}
              className={`card p-4 flex items-center gap-4 transition-all ${
                selected.has(r.leave_request_id)
                  ? 'ring-2 ring-brand-400 border-brand-300 dark:border-brand-600'
                  : ''
              }`}
            >
              {/* Checkbox */}
              {filter === 'pending' && (
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded accent-brand-600 shrink-0"
                  checked={selected.has(r.leave_request_id)}
                  onChange={() => toggleSelect(r.leave_request_id)}
                />
              )}

              {/* Avatar */}
              <Avatar
                size="sm"
                user={{ employee_id: r.employee_id, role: 'employee' }}
                profile={{ first_name: r.employee_name?.split(' ')[0] || '?', last_name: r.employee_name?.split(' ')[1] || '' }}
                showText={false}
              />

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{r.employee_name || `User #${r.user_id}`}</span>
                  <span className={`badge ${
                    r.status === 'pending' ? 'badge-warning' :
                    r.status === 'approved' ? 'badge-success' :
                    'badge-danger'
                  }`}>{r.status}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="font-semibold">{r.leave_type_name || r.leave_type_id}</span>
                  {' · '}{formatDate(r.start_date)} — {formatDate(r.end_date)}
                  {' · '}{r.total_days}d
                  {r.reason && <span className="italic"> · "{r.reason.slice(0, 50)}{r.reason.length > 50 ? '…' : ''}"</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {r.status === 'pending' && (
                  <>
                    <button
                      onClick={() => singleAction(r.leave_request_id, 'approved')}
                      disabled={acting}
                      className="btn-success !py-1.5 !px-3 text-xs"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => singleAction(r.leave_request_id, 'rejected')}
                      disabled={acting}
                      className="btn-danger !py-1.5 !px-3 text-xs"
                    >
                      ✕ Reject
                    </button>
                  </>
                )}
                {r.status === 'approved' && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold">✓ Approved</span>
                )}
                {r.status === 'rejected' && (
                  <span className="text-xs text-red-600 dark:text-red-400 font-semibold">✕ Rejected</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3">
        <Link to="/leave" className="btn-outline text-sm">🏖️ Leave Management →</Link>
        <Link to="/admin/employees" className="btn-outline text-sm">🧑‍🤝‍🧑 Employee Directory →</Link>
      </div>
    </div>
  )
}
