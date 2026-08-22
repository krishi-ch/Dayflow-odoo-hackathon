import React from 'react'
import { Link, useLocation } from 'react-router-dom'

/**
 * Breadcrumb — auto-generates crumbs from the current URL path.
 * Pass custom `items` to override, or omit for auto-detection.
 *
 * Usage:
 *   <Breadcrumb />                              // auto
 *   <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Employees' }]} />  // custom
 */

const LABEL_MAP = {
  dashboard: 'Dashboard',
  profile: 'My Profile',
  attendance: 'Attendance',
  leave: 'Leave',
  payroll: 'Payroll',
  notifications: 'Notifications',
  'ai-assistant': 'AI Assistant',
  employees: 'Employees',
  admin: 'Admin',
  audit: 'Audit Logs',
}

export default function Breadcrumb({ items }) {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter(Boolean)

  const crumbs = items || pathnames.map((segment, i) => {
    const to = '/' + pathnames.slice(0, i + 1).join('/')
    const label = LABEL_MAP[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    return { label, to }
  })

  if (crumbs.length === 0) return null

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
      <Link to="/dashboard" className="hover:text-brand-700 transition font-medium">
        🏠 Home
      </Link>
      {crumbs.map((crumb, i) => (
        <React.Fragment key={i}>
          <span className="text-slate-300">/</span>
          {i === crumbs.length - 1 ? (
            <span className="font-semibold text-slate-700">{crumb.label}</span>
          ) : (
            <Link to={crumb.to} className="hover:text-brand-700 transition font-medium">
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
