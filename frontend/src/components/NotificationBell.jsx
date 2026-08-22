import React, { useEffect, useState } from 'react'
import api, { extractError } from '../utils/api.js'
import { formatDateTime } from '../utils/formatters.js'
import { toast } from './Toast.jsx'
import { Link } from 'react-router-dom'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ total: 0, unread: 0 })
  const [items, setItems] = useState([])

  const refreshCount = async () => {
    try {
      const { data: c } = await api.get('/notifications/count')
      setData(c)
    } catch {}
  }
  const refreshList = async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 8, only_unread: false } })
      setItems(data)
    } catch (e) {
      toast.error(extractError(e, 'Could not load notifications'))
    }
  }

  useEffect(() => {
    refreshCount()
    const t = setInterval(refreshCount, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (open) refreshList()
  }, [open])

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all')
      setItems((xs) => xs.map((x) => ({ ...x, is_read: true })))
      setData((d) => ({ ...d, unread: 0 }))
      toast.success('Marked all as read')
    } catch (e) {
      toast.error(extractError(e))
    }
  }

  const markOne = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`)
      setItems((xs) => xs.map((x) => x.notification_id === id ? { ...x, is_read: true } : x))
      setData((d) => ({ ...d, unread: Math.max(0, d.unread - 1) }))
    } catch {}
  }

  const iconFor = (t) => ({
    info: 'ℹ️', leave_request: '📝', leave_approved: '✅',
    leave_rejected: '❌', attendance_flag: '🕘', payroll_generated: '💰',
  }[t] || '🔔')

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-full grid place-items-center text-slate-600 hover:bg-slate-100 transition"
        aria-label="Notifications"
      >
        <span className="text-lg">🔔</span>
        {data.unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger-600 text-white text-[10px] font-bold grid place-items-center ring-2 ring-white">
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[min(92vw,380px)] bg-white rounded-2xl border border-slate-200 shadow-pop z-40 animate-slideUp overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <div>
                <div className="font-semibold text-slate-900">Notifications</div>
                <div className="text-xs text-slate-500">{data.unread} unread · {data.total} total</div>
              </div>
              {data.unread > 0 && (
                <button onClick={markAll} className="text-xs text-brand-700 hover:underline font-semibold">Mark all read</button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {items.length === 0 && (
                <div className="p-6 text-sm text-slate-500 text-center">No notifications yet.</div>
              )}
              {items.map((n) => (
                <button
                  key={n.notification_id}
                  onClick={() => markOne(n.notification_id)}
                  className={`w-full text-left p-4 hover:bg-slate-50 transition flex gap-3 ${!n.is_read ? 'bg-brand-50/40' : ''}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-white grid place-items-center shadow-card text-lg shrink-0 border border-slate-100">{iconFor(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`font-semibold text-sm ${!n.is_read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</div>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" />}
                    </div>
                    {n.message && <div className="text-sm text-slate-600 line-clamp-2 mt-0.5">{n.message}</div>}
                    <div className="text-[11px] text-slate-400 mt-1">{formatDateTime(n.created_at)}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 p-2 bg-slate-50/60">
              <Link to="/notifications" onClick={() => setOpen(false)} className="block text-center text-sm font-semibold text-brand-700 hover:bg-brand-50 rounded-lg py-2">View all notifications →</Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
