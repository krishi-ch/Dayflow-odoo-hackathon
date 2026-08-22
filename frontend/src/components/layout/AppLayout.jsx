import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import Avatar from '../Avatar.jsx'
import ToastContainer from '../Toast.jsx'
import NotificationBell from '../NotificationBell.jsx'
import Breadcrumb from '../Breadcrumb.jsx'

const NAV_EMPLOYEE = [
  { to: '/dashboard',     label: 'Dashboard',      icon: '📊' },
  { to: '/profile',       label: 'My Profile',     icon: '👤' },
  { to: '/attendance',    label: 'Attendance',     icon: '🕘' },
  { to: '/leave',         label: 'Leave',          icon: '🏖️' },
  { to: '/payroll',       label: 'Payroll',        icon: '💰' },
  { to: '/notifications', label: 'Notifications',  icon: '🔔' },
  { to: '/ai-assistant',  label: 'AI Assistant',   icon: '✨' },
]

const NAV_ADMIN_EXTRA = [
  { to: '/admin/employees', label: 'Employees',    icon: '🧑‍🤝‍🧑' },
  { to: '/admin/audit',     label: 'Audit Logs',   icon: '🛡️' },
]

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const nav = isAdmin ? [...NAV_EMPLOYEE, ...NAV_ADMIN_EXTRA] : NAV_EMPLOYEE

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden md:flex md:flex-col w-64 border-r border-slate-200 bg-white">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white grid place-items-center font-extrabold shadow-card">D</div>
          <div>
            <div className="font-extrabold text-slate-900 leading-none tracking-tight">Dayflow</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mt-0.5">HRMS · v1.0</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}>
              <span className="text-base leading-none">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button onClick={onLogout} className="sidebar-link w-full hover:bg-rose-50 hover:text-rose-700 text-slate-600">
            <span>🚪</span><span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between gap-3">
          <div className="md:hidden flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 text-white grid place-items-center font-extrabold">D</div>
            <span className="font-extrabold">Dayflow</span>
          </div>
          <div className="hidden md:flex flex-col leading-tight">
            <div className="text-xs text-slate-500">Welcome back 👋</div>
            <div className="font-semibold text-slate-900">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <NotificationBell />
            <button
              className="md:hidden btn-ghost px-2"
              onClick={() => document.getElementById('mobile-nav')?.classList.toggle('hidden')}
              aria-label="Menu"
            >☰</button>
            <div className="hidden sm:block">
              <div className="pr-2 pl-1 py-1 border border-slate-200 rounded-full bg-slate-50">
                <div className="flex items-center gap-2">
                  <Avatar size="sm" user={user} profile={{ first_name: user?.email?.split('@')[0] }} />
                </div>
              </div>
            </div>
            <button onClick={onLogout} className="hidden md:inline-flex btn-outline text-sm" title="Logout">Sign out</button>
          </div>
        </header>

        <div id="mobile-nav" className="md:hidden hidden border-b border-slate-200 bg-white p-3 grid grid-cols-3 gap-2">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) =>
                `p-2 rounded-xl text-center text-xs font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 bg-slate-50'}`}>
              <div className="text-xl mb-0.5">{n.icon}</div>{n.label}
            </NavLink>
          ))}
        </div>

        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
