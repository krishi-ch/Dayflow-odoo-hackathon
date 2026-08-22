import React, { useEffect, useState } from 'react'

let listeners = []
let globalToasts = []
const pushToast = (t) => {
  const id = Date.now() + Math.random()
  const toast = { id, type: 'info', duration: 3500, ...t }
  globalToasts = [...globalToasts, toast]
  listeners.forEach((fn) => fn([...globalToasts]))
  if (toast.duration > 0) {
    setTimeout(() => {
      globalToasts = globalToasts.filter((x) => x.id !== id)
      listeners.forEach((fn) => fn([...globalToasts]))
    }, toast.duration)
  }
  return id
}
export const toast = {
  success: (m) => pushToast({ type: 'success', message: m }),
  error:   (m) => pushToast({ type: 'error',   message: m }),
  warning: (m) => pushToast({ type: 'warning', message: m }),
  info:    (m) => pushToast({ type: 'info',    message: m }),
  promise: async (p, msgs) => {
    const id = pushToast({ type: 'loading', message: msgs.loading, duration: 0 })
    try {
      const r = await p
      globalToasts = globalToasts.filter((x) => x.id !== id)
      pushToast({ type: 'success', message: msgs.success })
      return r
    } catch (e) {
      globalToasts = globalToasts.filter((x) => x.id !== id)
      pushToast({ type: 'error', message: msgs.error })
      throw e
    }
  },
}

export default function ToastContainer() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const fn = (arr) => setItems(arr)
    listeners.push(fn)
    return () => { listeners = listeners.filter((l) => l !== fn) }
  }, [])

  const colors = {
    success: 'bg-success-600 border-success-600',
    error:   'bg-danger-600  border-danger-600',
    warning: 'bg-warning-500 border-warning-500',
    info:    'bg-brand-600   border-brand-600',
    loading: 'bg-slate-700   border-slate-700',
  }
  const icon = {
    success: '✓', error: '✕', warning: '!', info: 'ℹ', loading: '⟳',
  }

  return (
    <div className="fixed z-[100] top-4 right-4 flex flex-col gap-2 w-[min(92vw,380px)]">
      {items.map((t) => (
        <div
          key={t.id}
          className={`text-white rounded-xl shadow-pop px-4 py-3 border flex items-start gap-3 animate-slideUp ${colors[t.type] || colors.info}`}
        >
          <span className={`font-bold text-lg leading-none mt-0.5 ${t.type === 'loading' ? 'animate-spin inline-block' : ''}`}>
            {icon[t.type] || icon.info}
          </span>
          <div className="flex-1 text-sm">{t.message}</div>
        </div>
      ))}
    </div>
  )
}
