import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { toast } from '../components/Toast.jsx'
import { validate, email as emailValidator, required } from '../utils/validate.js'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@dayflow.tech')
  const [password, setPassword] = useState('Admin@123')
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    const errs = {}
    const emailErr = validate(email, required('Email'), emailValidator)
    if (emailErr) errs.email = emailErr
    const passErr = validate(password, required('Password'))
    if (passErr) errs.password = passErr
    setFieldErrors(errs)
    if (Object.keys(errs).length) return

    const res = await login(email.trim(), password)
    if (res.ok) {
      toast.success('Welcome back! 👋')
      navigate('/dashboard', { replace: true })
    } else {
      setError(res.error)
      toast.error(res.error)
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-slate-950 overflow-hidden">
      {/* ── Left panel: gradient + floating orbs + mockup ── */}
      <div className="hidden md:flex flex-col justify-between relative overflow-hidden">
        {/* Gradient background matching landing page */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.3),transparent_50%)]" />

        {/* Floating orbs */}
        <div className="absolute top-16 left-[10%] w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-[10%] w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 p-12 flex flex-col justify-between h-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 grid place-items-center text-xl font-extrabold shadow-lg shadow-black/10">D</div>
            <div>
              <div className="text-xl font-extrabold tracking-tight text-white">Dayflow</div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-semibold">Human Resource Management</div>
            </div>
          </div>

          {/* Tagline */}
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.08] tracking-tight text-white">
              Every workday,<br />
              <span className="bg-gradient-to-r from-brand-200 via-indigo-200 to-brand-100 bg-clip-text text-transparent">
                perfectly aligned.
              </span>
            </h1>
            <p className="text-white/65 text-lg leading-relaxed">
              Manage employees, attendance, leave approvals and payroll — all from one modern, secure platform.
            </p>

            {/* Animated dashboard mockup */}
            <div className="relative mt-8">
              <div className="rounded-xl bg-slate-800/80 backdrop-blur-sm border border-white/10 p-1 shadow-2xl shadow-black/30">
                <div className="bg-slate-800 rounded-t-lg px-3 py-2 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <div className="flex-1 mx-2">
                    <div className="bg-slate-700/60 rounded px-2 py-0.5 text-[10px] text-slate-400 text-center font-mono">
                      app.dayflow.tech/dashboard
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-b-lg p-3 space-y-2">
                  {[
                    { name: 'Priya Sharma', role: 'HR Executive', color: 'from-brand-500 to-brand-700', status: 'bg-success-400' },
                    { name: 'Rohan Mehta', role: 'Senior Engineer', color: 'from-emerald-500 to-emerald-700', status: 'bg-success-400' },
                    { name: 'Alex Johnson', role: 'Product Designer', color: 'from-violet-500 to-violet-700', status: 'bg-amber-400' },
                  ].map((e) => (
                    <div key={e.name} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${e.color} text-white grid place-items-center text-[8px] font-bold`}>
                        {e.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-slate-800 truncate">{e.name}</div>
                        <div className="text-[8px] text-slate-500">{e.role}</div>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ${e.status}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span>PostgreSQL</span>
            <span className="text-white/20">·</span>
            <span>FastAPI</span>
            <span className="text-white/20">·</span>
            <span>React</span>
          </div>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-slate-50 relative">
        {/* Subtle radial glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden mb-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white grid place-items-center font-extrabold shadow-lg shadow-brand-500/25">D</div>
            <div>
              <div className="font-extrabold text-xl text-slate-900">Dayflow</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">HRMS</div>
            </div>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-2 text-slate-500">Welcome back! Enter your credentials to access the dashboard.</p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <div>
              <label className="label">Work email</label>
              <input type="email" autoComplete="email"
                className={`input ${fieldErrors.email ? '!border-danger-500 !ring-danger-500/40' : ''}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => {
                  const err = validate(email, required('Email'), emailValidator)
                  setFieldErrors((prev) => ({ ...prev, email: err || undefined }))
                }}
                placeholder="you@dayflow.tech" />
              {fieldErrors.email && <p className="text-xs text-danger-600 mt-1">{fieldErrors.email}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0">Password</label>
                <span className="text-xs text-slate-500">min 8 chars · upper · lower · number · symbol</span>
              </div>
              <input type="password" autoComplete="current-password"
                className={`input ${fieldErrors.password ? '!border-danger-500 !ring-danger-500/40' : ''}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => {
                  const err = validate(password, required('Password'))
                  setFieldErrors((prev) => ({ ...prev, password: err || undefined }))
                }}
                placeholder="••••••••" />
              {fieldErrors.password && <p className="text-xs text-danger-600 mt-1">{fieldErrors.password}</p>}
            </div>

            {error && <div className="rounded-lg bg-rose-50 text-rose-700 border border-rose-100 px-3 py-2 text-sm" role="alert">{error}</div>}

            <button className="btn-primary w-full py-3 shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5 transition-all" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-700 mb-1">Demo logins</div>
              <div>Admin: <code className="text-slate-800 font-mono">admin@dayflow.tech / Admin@123</code></div>
              <div>HR:    <code className="text-slate-800 font-mono">hr@dayflow.tech / Hr@12345</code></div>
              <div>Emp:   <code className="text-slate-800 font-mono">alex@dayflow.tech / Alex@1234</code></div>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            New to Dayflow?{' '}
            <Link to="/signup" className="text-brand-700 font-semibold hover:underline">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
