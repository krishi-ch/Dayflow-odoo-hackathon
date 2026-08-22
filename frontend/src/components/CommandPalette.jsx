import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

const COMMANDS = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: '📊', path: '/dashboard', keywords: 'home main' },
  { id: 'employees', label: 'Go to Employees', icon: '🧑‍🤝‍🧑', path: '/admin/employees', keywords: 'team staff people', adminOnly: true },
  { id: 'attendance', label: 'Go to Attendance', icon: '🕘', path: '/attendance', keywords: 'check in clock timesheet' },
  { id: 'leave', label: 'Go to Time Off', icon: '🏖️', path: '/leave', keywords: 'vacation sick leave pto' },
  { id: 'profile', label: 'Go to Profile', icon: '👤', path: '/profile', keywords: 'personal info account' },
  { id: 'payroll', label: 'Go to Payroll', icon: '💰', path: '/payroll', keywords: 'salary payslip payment' },
  { id: 'notifications', label: 'Go to Notifications', icon: '🔔', path: '/notifications', keywords: 'alerts messages' },
  { id: 'analytics', label: 'Go to Analytics', icon: '📈', path: '/analytics', keywords: 'charts graphs data insights reports', adminOnly: true },
  { id: 'calendar', label: 'Go to Calendar', icon: '📅', path: '/calendar', keywords: 'monthly view schedule' },
  { id: 'payslip', label: 'Go to Payslip', icon: '📄', path: '/payslip', keywords: 'salary payslip download pdf' },
  { id: 'approvals', label: 'Bulk Approvals', icon: '⚡', path: '/admin/approvals', keywords: 'leave approve reject bulk', adminOnly: true },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { toggle, dark } = useTheme()

  const filtered = useMemo(() => {
    const cmds = COMMANDS.filter((c) => !c.adminOnly || isAdmin)
    if (!query) return cmds
    const q = query.toLowerCase()
    return cmds.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q) ||
        c.path.toLowerCase().includes(q)
    )
  }, [query, isAdmin])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => { setSelected(0) }, [query])

  const runCommand = (cmd) => {
    setOpen(false)
    if (cmd.id === 'theme') {
      toggle()
    } else if (cmd.path) {
      navigate(cmd.path)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && filtered[selected]) {
      runCommand(filtered[selected])
    }
  }

  const allCommands = [
    ...filtered,
    { id: 'theme', label: `Switch to ${dark ? 'light' : 'dark'} mode`, icon: dark ? '☀️' : '🌙', keywords: 'theme dark light toggle' },
  ]

  const displayCommands = !query
    ? allCommands
    : allCommands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.keywords.toLowerCase().includes(query.toLowerCase())
      )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none text-sm"
          />
          <kbd className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-2">
          {displayCommands.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No commands found</div>
          )}
          {displayCommands.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => runCommand(cmd)}
              onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                i === selected
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <span className="text-lg w-7 text-center">{cmd.icon}</span>
              <span className="flex-1 text-left">{cmd.label}</span>
              {cmd.path && (
                <kbd className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{cmd.path}</kbd>
              )}
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">↵</kbd> select</span>
          <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
