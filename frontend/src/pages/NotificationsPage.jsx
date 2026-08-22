import React, { useEffect, useState } from 'react'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import { formatDateTime, statusBadge } from '../utils/formatters.js'
import { Link } from 'react-router-dom'

export default function NotificationsPage() {
  const [items, setItems] = useState([])
  const [count, setCount] = useState({ total: 0, unread: 0 })
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const [{ data: notif }, { data: c }] = await Promise.all([
        api.get('/notifications', { params: { limit: 200 } }),
        api.get('/notifications/count'),
      ])
      setItems(notif); setCount(c)
    } catch (e) { toast.error(extractError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all')
      toast.success('All marked as read ✅')
      refresh()
    } catch (e) { toast.error(extractError(e)) }
  }

  const markOne = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`)
      refresh()
    } catch (e) { toast.error(extractError(e)) }
  }

  const iconFor = (t) => ({
    info: 'ℹ️', leave_request: '📝', leave_approved: '✅',
    leave_rejected: '❌', attendance_flag: '🕘', payroll_generated: '💰',
  }[t] || '🔔')

  const linkFor = (n) => {
    switch (n.reference_type) {
      case 'leave_request': return `/leave#${n.reference_id}`
      case 'attendance':    return '/attendance'
      case 'payroll':       return '/payroll'
      default:              return '/notifications'
    }
  }

  return (
    <div className="space-y-6 animate-slideUp">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Inbox</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Notifications</h1>
          <p className="mt-1 text-slate-500 text-sm">Real-time alerts for approvals, attendance flags, payroll, and more.</p>
        </div>
        <div className="flex gap-2">
          <span className="badge-info">{count.unread} unread</span>
          <span className="badge-muted">{count.total} total</span>
          {count.unread > 0 && <button className="btn-primary" onClick={markAll}>✓ Mark all as read</button>}
        </div>
      </header>

      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-sm text-slate-500 text-center">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-14 text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center text-4xl">🔔</div>
            <div className="font-bold text-slate-900">Inbox zero!</div>
            <div className="text-sm text-slate-500">You'll see system notifications here as you use Dayflow.</div>
            <Link to="/dashboard" className="btn-primary">← Back to Dashboard</Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.notification_id}>
                <Link to={linkFor(n)} onClick={() => !n.is_read && markOne(n.notification_id)}
                  className={`block p-5 flex items-start gap-4 hover:bg-slate-50/80 transition ${!n.is_read ? 'bg-brand-50/40' : ''}`}>
                  <div className="w-11 h-11 rounded-xl bg-white grid place-items-center text-xl shadow-card border border-slate-100 shrink-0">{iconFor(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold ${!n.is_read ? 'text-slate-900' : 'text-slate-700'}`}>{n.title}</span>
                      <span className={statusBadge(String(n.type).includes('approved') ? 'approved' : String(n.type).includes('rejected') ? 'rejected' : n.type)}>
                        {String(n.type).replace('_', ' ')}
                      </span>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0 ml-auto" />}
                    </div>
                    {n.message && <p className="mt-1 text-sm text-slate-600">{n.message}</p>}
                    <div className="mt-1 text-xs text-slate-400">{formatDateTime(n.created_at)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
