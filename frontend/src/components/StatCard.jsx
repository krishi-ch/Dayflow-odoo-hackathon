import React from 'react'

export default function StatCard({
  title, value, hint, icon, tone = 'brand', onClick, action,
}) {
  const tones = {
    brand:   'from-brand-50 to-white text-brand-700 border-brand-100',
    green:   'from-green-50  to-white text-green-700 border-green-100',
    amber:   'from-amber-50  to-white text-amber-700 border-amber-100',
    rose:    'from-rose-50   to-white text-rose-700  border-rose-100',
    violet:  'from-violet-50 to-white text-violet-700 border-violet-100',
    slate:   'from-slate-50  to-white text-slate-700  border-slate-100',
  }
  const iconBg = {
    brand:   'bg-brand-600',
    green:   'bg-success-600',
    amber:   'bg-warning-500',
    rose:    'bg-danger-600',
    violet:  'bg-violet-600',
    slate:   'bg-slate-600',
  }
  return (
    <div className={`card card-body bg-gradient-to-br ${tones[tone]} ${onClick ? 'cursor-pointer hover:shadow-pop transition' : ''}`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{title}</div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
          {hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}
        </div>
        <div className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shadow-card ${iconBg[tone]}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
