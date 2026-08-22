import React, { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import Avatar from '../Avatar.jsx'
import ToastContainer from '../Toast.jsx'
import NotificationBell from '../NotificationBell.jsx'
import Breadcrumb from '../Breadcrumb.jsx'
import CommandPalette from '../CommandPalette.jsx'

const NAV_LINKS = [
  { to: '/dashboard',   label: 'Dashboard',   icon: '📊' },
  { to: '/admin/employees', label: 'Employees', icon: '🧑‍🤝‍🧑', adminOnly: true },
  { to: '/attendance',  label: 'Attendance',  icon: '🕘' },
  { to: '/leave',       label: 'Time Off',    icon: '🏖️' },
  { to: '/analytics',   label: 'Analytics',   icon: '📈', adminOnly: true },
]

const DROPDOWN_ITEMS = [
  { to: '/profile',       label: 'My Profile',    icon: '👤' },
  { to: '/calendar',      label: 'Calendar',      icon: '📅' },
  { to: '/payslip',       label: 'Payslip',       icon: '📄' },
  { to: '/payroll',       label: 'Payroll',       icon: '💰' },
  { to: '/admin/approvals', label: 'Bulk Approvals', icon: '⚡', adminOnly: true },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
]

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close dropdown on navigation
  useEffect(() => { setDropdownOpen(false) }, [location.pathname])

  const onLogout = async () => {
    setDropdownOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const filteredNav = NAV_LINKS.filter((n) => !n.adminOnly || isAdmin)
  const filteredDropdown = DROPDOWN_ITEMS.filter((n) => !n.adminOnly || isAdmin)

  const { dark, toggle } = useTheme()

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between gap-4 transition-colors">
        {/* Left: Logo + Company Name */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 text-white grid place-items-center font-extrabold text-sm shadow-card">
            D
          </div>
          <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-lg hidden sm:inline">Dayflow</span>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {filteredNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/dashboard'}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: Search + Dark mode toggle + Notification Bell + Avatar Dropdown */}
        <div className="flex items-center gap-2">
          {/* Command palette trigger */}
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition border border-slate-200 dark:border-slate-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search
            <kbd className="text-[10px] font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-600">⌘K</kbd>
          </button>

          {/* Dark mode toggle */}
          <button onClick={toggle} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {dark ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          <NotificationBell />
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
            >
              <Avatar size="sm" user={user} profile={{ first_name: user?.email?.split('@')[0], last_name: '' }} />
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden animate-slideUp">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-700/50">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {user?.email}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {isAdmin ? 'Admin / HR' : 'Employee'} · {user?.employee_id || ''}
                  </div>
                </div>
                <div className="py-1">
                  {filteredDropdown.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                      isActive
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`
                      }
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
                <div className="border-t border-slate-100 py-1">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition"
                  >
                    <span className="text-base">🚪</span>
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 flex gap-1 overflow-x-auto">
        {filteredNav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/dashboard'}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700'
              }`
            }
          >
            {n.icon} {n.label}
          </NavLink>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1400px] w-full mx-auto text-slate-900 dark:text-slate-100">
        <Breadcrumb />
        <Outlet />
      </main>

      <CommandPalette />
      <ToastContainer />
    </div>
  )
}
