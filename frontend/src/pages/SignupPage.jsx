import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { toast } from '../components/Toast.jsx'
import { validate, email as emailValidator, required, minLength, passwordStrength } from '../utils/validate.js'

const RULES = [
  { re: /.{8,}/, label: 'At least 8 characters' },
  { re: /[A-Z]/, label: 'One uppercase letter' },
  { re: /[a-z]/, label: 'One lowercase letter' },
  { re: /[0-9]/, label: 'One digit' },
  { re: /[!@#$%^&*(),.?":{}|<>]/, label: 'One special character' },
]

export default function SignupPage() {
  const { signup, loading } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    employee_id: 'EMP007', email: 'new@dayflow.tech', password: 'Dayflow@123', role: 'employee',
  })
  const [serverErr, setServerErr] = useState('')
  const [success, setSuccess] = useState(false)

  const passwordOk = useMemo(() => RULES.map((r) => r.re.test(form.password)), [form.password])
  const pct = Math.round((passwordOk.filter(Boolean).length / RULES.length) * 100)
  const pwTone = pct < 40 ? 'danger' : pct < 80 ? 'warning' : 'success'

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const [fieldErrors, setFieldErrors] = useState({})

  const submit = async (e) => {
    e.preventDefault()
    setServerErr('')

    const errs = {}
    const eidErr = validate(form.employee_id, required('Employee ID'), minLength(2, 'Employee ID'))
    if (eidErr) errs.employee_id = eidErr
    const emailErr = validate(form.email, required('Email'), emailValidator)
    if (emailErr) errs.email = emailErr
    if (!passwordOk.every(Boolean)) {
      const pw = passwordStrength(form.password)
      errs.password = pw.errors[0] || 'Password does not meet requirements'
    }
    setFieldErrors(errs)
    if (Object.keys(errs).length) return

    const res = await signup(form)
    if (res.ok) {
      setSuccess(true)
      toast.success('Account created! Use the verification link.')
      setTimeout(() => navigate('/verify'), 300)
    } else {
      setServerErr(res.error)
      toast.error(res.error)
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-slate-950 overflow-hidden">
      {/* ── Left panel: gradient + floating orbs + features ── */}
      <div className="hidden md:flex flex-col justify-between relative overflow-hidden">
        {/* Gradient background matching landing page */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.3),transparent_50%)]" />

        {/* Floating orbs */}
        <div className="absolute top-16 left-[10%] w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-[10%] w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 p-12 flex flex-col justify-between h-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 grid place-items-center text-xl font-extrabold shadow-lg shadow-black/10">D</div>
            <div>
              <div className="text-xl font-extrabold tracking-tight text-white">Dayflow</div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-semibold">Create your account</div>
            </div>
          </div>

          {/* Tagline + features */}
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.08] tracking-tight text-white">
              Join Dayflow<br />
              <span className="bg-gradient-to-r from-brand-200 via-indigo-200 to-brand-100 bg-clip-text text-transparent">
                in under a minute.
              </span>
            </h1>
            <p className="text-white/65 text-lg leading-relaxed">
              Sign up with your Employee ID. Your Admin/HR will verify your role and grant access to company data.
            </p>

            {/* Feature cards */}
            <div className="space-y-3 pt-2">
              {[
                { icon: '🔐', title: 'Secure by design', desc: 'Passwords hashed with bcrypt, JWT access + refresh tokens' },
                { icon: '🛡️', title: 'Role-based access', desc: 'Admin, HR, and Employee roles with granular permissions' },
                { icon: '📜', title: 'Full audit trail', desc: 'Every action logged with IP, timestamp, and before/after values' },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-3 bg-white/8 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
                  <div className="w-9 h-9 rounded-lg bg-white/10 grid place-items-center text-lg shrink-0 mt-0.5">{f.icon}</div>
                  <div>
                    <div className="text-sm font-bold text-white">{f.title}</div>
                    <div className="text-xs text-white/50 mt-0.5">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-xs text-white/40">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success-400" />
              <span>13 DB tables</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success-400" />
              <span>60+ API endpoints</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-slate-50 relative">
        {/* Subtle radial glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white grid place-items-center font-extrabold shadow-lg shadow-brand-500/25">D</div>
            <div>
              <div className="font-extrabold text-xl text-slate-900">Dayflow</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">HRMS</div>
            </div>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Create your account</h2>
          <p className="mt-2 text-slate-500">We'll send a verification link. (Demo mode: check /verify)</p>

          {success ? (
            <div className="mt-7 card card-body border-green-200 bg-green-50 text-green-800 space-y-2">
              <div className="text-xl font-bold">🎉 Account created!</div>
              <p className="text-sm">In production you'd receive a verification email. For demo, use the verification page.</p>
              <Link to="/verify" className="btn-success inline-flex mt-2">Go to verification page →</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Employee ID</label>
                  <input className={`input ${fieldErrors.employee_id ? '!border-danger-500' : ''}`} value={form.employee_id} onChange={update('employee_id')} placeholder="EMP001" />
                  {fieldErrors.employee_id && <p className="text-xs text-danger-600 mt-1">{fieldErrors.employee_id}</p>}
                </div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={form.role} onChange={update('role')}>
                    <option value="employee">Employee</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input type="email" className={`input ${fieldErrors.email ? '!border-danger-500' : ''}`} value={form.email} onChange={update('email')} placeholder="you@dayflow.tech" />
                {fieldErrors.email && <p className="text-xs text-danger-600 mt-1">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={form.password} onChange={update('password')} />
                <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${pwTone === 'danger' ? 'bg-danger-500' : pwTone === 'warning' ? 'bg-warning-500' : 'bg-success-600'}`}
                       style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                  {RULES.map((r, i) => (
                    <div key={r.label} className={`flex items-center gap-1.5 ${passwordOk[i] ? 'text-success-600' : 'text-slate-500'}`}>
                      <span>{passwordOk[i] ? '✓' : '○'}</span>{r.label}
                    </div>
                  ))}
                </div>
              </div>

              {serverErr && <div className="rounded-lg bg-rose-50 text-rose-700 border border-rose-100 px-3 py-2 text-sm" role="alert">{serverErr}</div>}

              <button className="btn-primary w-full py-3 shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5 transition-all" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account →'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="text-brand-700 font-semibold hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
