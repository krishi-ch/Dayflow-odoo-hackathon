import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { toast } from '../components/Toast.jsx'
import api, { extractError } from '../utils/api.js'

export default function VerifyPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { verifyEmail, loading, user } = useAuth()
  const [token, setToken] = useState(params.get('token') || '')
  const [done, setDone] = useState(false)
  const [demoTokens, setDemoTokens] = useState([])

  useEffect(() => {
    // Probe auth state without triggering 401 redirect
    const token = localStorage.getItem('dayflow:access_token')
    if (token) {
      api.get('/auth/me', { _skipRedirect: true }).catch(() => {})
    }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!token) { toast.warning('Please enter a token.'); return }
    const res = await verifyEmail(token.trim())
    if (res.ok) {
      setDone(true)
      toast.success('Email verified. Signing you in…')
      setTimeout(() => navigate('/dashboard', { replace: true }), 400)
    } else {
      toast.error(res.error)
    }
  }

  if (user?.is_verified) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <div className="card card-body max-w-md text-center space-y-3">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-extrabold text-slate-900">Already verified!</h1>
          <p className="text-slate-500 text-sm">Your email is confirmed.</p>
          <Link to="/dashboard" className="btn-primary">Go to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="card card-body w-full max-w-md animate-slideUp">
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 grid place-items-center text-3xl">✉️</div>
          <h1 className="text-2xl font-extrabold mt-3 text-slate-900">Verify your email</h1>
          <p className="text-slate-500 text-sm mt-1">
            Paste the verification token sent to your email. For demo, you can also directly re-signup and grab the DB token.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="label">Verification token</label>
          <input className="input font-mono text-sm" value={token}
            onChange={(e) => setToken(e.target.value)} placeholder="abc123XYZ..." />
          {done ? (
            <div className="rounded-xl bg-green-50 text-green-800 border border-green-200 px-3 py-3 text-sm text-center">
              ✅ Verified! Redirecting…
            </div>
          ) : (
            <button className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & Sign in'}
            </button>
          )}
        </form>
        <div className="mt-5 text-xs text-slate-500 space-y-1">
          <p>💡 For demo purposes, you can also:</p>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            <li>Query <code className="bg-slate-100 px-1 rounded">users.verification_token</code> manually</li>
            <li>Use the pre-seeded accounts (they're already verified): <code className="bg-slate-100 px-1 rounded">admin@dayflow.tech / Admin@123</code></li>
          </ul>
        </div>
        <div className="mt-5 text-center text-sm">
          <Link to="/login" className="text-brand-700 font-semibold hover:underline">← Back to Sign in</Link>
        </div>
      </div>
    </div>
  )
}
