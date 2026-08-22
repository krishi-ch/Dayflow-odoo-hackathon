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

    // Robust client-side validation
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
    <div className="min-h-screen grid md:grid-cols-2 bg-slate-50">
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur grid place-items-center text-2xl font-extrabold shadow-pop">D</div>
          <div>
            <div className="text-2xl font-extrabold tracking-tight">Dayflow</div>
            <div className="text-xs uppercase tracking-[0.25em] text-white/70">Human Resource Management</div>
          </div>
        </div>
        <div className="relative max-w-md space-y-6">
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight">
            Every workday,<br />
            <span className="text-brand-100">perfectly aligned.</span>
          </h1>
          <p className="text-white/80 text-lg leading-relaxed">
            Manage employees, attendance, leave approvals and payroll — all from one modern, secure platform.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-6">
            {[
              ['🚀', 'Real-time'],
              ['🔐', 'Secure by design'],
              ['📊', 'Report-ready'],
            ].map(([i, l]) => (
              <div key={l} className="rounded-xl bg-white/10 backdrop-blur border border-white/15 px-3 py-4 text-center">
                <div className="text-2xl mb-1">{i}</div>
                <div className="text-xs font-semibold text-white/90">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-white/60 text-sm">© {new Date().getFullYear()} Dayflow HRMS — Build #1.0</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white grid place-items-center font-extrabold shadow-card">D</div>
            <div className="font-extrabold text-xl text-slate-900">Dayflow</div>
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

            <button className="btn-primary w-full py-3" disabled={loading}>
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
