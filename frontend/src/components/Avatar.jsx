import React from 'react'
import { initials } from '../utils/formatters.js'

export default function Avatar({ user, profile, size = 'md', showText = true }) {
  const first = profile?.first_name || user?.email?.split('@')[0] || '?'
  const last  = profile?.last_name ?? ''
  const pict  = profile?.profile_picture_url
  const dim =
    size === 'xs' ? 'h-6 w-6 text-xs' :
    size === 'sm' ? 'h-8 w-8 text-xs' :
    size === 'lg' ? 'h-12 w-12 text-lg' :
    size === 'xl' ? 'h-20 w-20 text-2xl' :
                    'h-10 w-10 text-sm'
  const roleBadge = user?.role
    ? (user.role === 'admin' ? 'ADM' : user.role === 'hr' ? 'HR' : 'EMP')
    : null

  return (
    <div className="flex items-center gap-3">
      <div className={`inline-flex items-center justify-center rounded-full font-bold text-white ${dim} bg-gradient-to-br from-brand-500 to-brand-800 overflow-hidden ring-2 ring-white shadow-card`}>
        {pict ? (
          <img src={pict} alt={first} className="w-full h-full object-cover" />
        ) : (
          <span>{initials(first, last)}</span>
        )}
      </div>
      {roleBadge !== null && showText && (
        <div className="leading-tight">
          <div className="font-semibold text-slate-800 text-sm">
            {profile ? `${profile.first_name} ${profile.last_name ?? ''}` : user?.email}
          </div>
          <div className="text-xs text-slate-500">{roleBadge} · {user?.employee_id || ''}</div>
        </div>
      )}
    </div>
  )
}
