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

    // Validate all fields before submission
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
    <div className="min-h-screen grid md:grid-cols-2 bg-slate-50">
      <div className="hidden md:flex items-center justify-center p-12 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 text-white">
        <div className="max-w-lg space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 grid place-items-center text-2xl font-extrabold shadow-pop">D</div>
            <div>
              <div className="text-2xl font-extrabold">Dayflow</div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">HRMS · Create account</div>
            </div>
          </div>
          <h2 className="text-4xl font-extrabold leading-tight">Join Dayflow in under a minute.</h2>
          <p className="text-white/80 text-lg">
            Sign up with your Employee ID. Your Admin/HR will verify your role and grant access to company data.
          </p>
          <ul className="space-y-3">
            {[
              '🔐 Passwords are hashed with bcrypt',
              '🛡️ Role-based access control (RBAC)',
              '📜 Every action is captured in audit logs',
            ].map((x) => (
              <li key={x} className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-4 py-3">
                <span>{x.split(' ')[0]}</span>
                <span className="text-sm">{x.slice(3)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white grid place-items-center font-extrabold">D</div>
            <div className="font-extrabold text-xl">Dayflow</div>
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

              <button className="btn-primary w-full py-3" disabled={loading}>
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
