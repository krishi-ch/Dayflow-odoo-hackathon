import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

function AnimatedCounter({ target, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = Date.now()
        const tick = () => {
          const elapsed = Date.now() - start
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setCount(Math.floor(eased * target))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

function FloatingCard({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function DashboardPreview() {
  const [active, setActive] = useState(0)
  const previews = [
    { label: 'Dashboard', color: 'from-brand-500 to-brand-700' },
    { label: 'Attendance', color: 'from-emerald-500 to-emerald-700' },
    { label: 'Payroll', color: 'from-violet-500 to-violet-700' },
  ]

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % previews.length), 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="relative mx-auto max-w-3xl">
      {/* Browser chrome */}
      <div className="rounded-t-2xl bg-slate-800 px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-slate-700 rounded-lg px-3 py-1 text-xs text-slate-400 text-center font-mono">
            app.dayflow.tech/dashboard
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="rounded-b-2xl bg-white border border-slate-200 border-t-0 shadow-2xl overflow-hidden">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-16 bg-slate-900 py-4 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center text-white text-xs font-bold">D</div>
            {['📊', '🧑‍🤝‍🧑', '🕘', '🏖️', '💰'].map((icon, i) => (
              <div key={i} className={`w-10 h-10 rounded-xl grid place-items-center text-lg transition-all ${i === active ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                {icon}
              </div>
            ))}
          </div>
          {/* Main */}
          <div className="flex-1 p-4 min-h-[280px]">
            <div className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">Admin / HR</div>
            <div className="text-lg font-bold text-slate-900 mb-3">{previews[active].label} Overview</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[['8', 'Employees'], ['0', 'Present'], ['2', 'Pending']].map(([v, l]) => (
                <div key={l} className="bg-slate-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-slate-900">{v}</div>
                  <div className="text-[10px] text-slate-500">{l}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {['Priya Sharma', 'Rohan Mehta', 'Alex Johnson'].map((name, i) => (
                <div key={name} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${previews[active].color} text-white grid place-items-center text-[10px] font-bold`}>
                    {name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-800">{name}</div>
                    <div className="text-[10px] text-slate-500">{['HR Executive', 'Senior Engineer', 'Product Designer'][i]}</div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-success-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: '🔐', title: 'Secure Authentication', desc: 'JWT access + refresh tokens, bcrypt hashing, account lockout after failed attempts.', color: 'from-blue-500 to-blue-600' },
  { icon: '🕘', title: 'Real-time Attendance', desc: 'Live check-in/out timer, month-wise tracking, overtime calculation, admin oversight.', color: 'from-emerald-500 to-emerald-600' },
  { icon: '🏖️', title: 'Leave Management', desc: 'Apply for paid/sick/casual leave, real-time balance, one-click admin approval workflow.', color: 'from-amber-500 to-amber-600' },
  { icon: '💰', title: 'Payroll Engine', desc: 'Auto-calculated components (Basic, HRA, PF, Tax), PDF payslips, CSV export.', color: 'from-violet-500 to-violet-600' },
  { icon: '📊', title: 'Employee Directory', desc: 'Card-based team view with status dots, search, profile detail modals.', color: 'from-pink-500 to-pink-600' },
  { icon: '🛡️', title: 'Audit Trail', desc: 'Every action logged with IP, timestamp, and before/after values for compliance.', color: 'from-slate-600 to-slate-700' },
]

const STATS = [
  { value: 13, suffix: '', label: 'Database Tables', icon: '🐘' },
  { value: 60, suffix: '+', label: 'API Endpoints', icon: '⚡' },
  { value: 8, suffix: '', label: 'Demo Employees', icon: '🧑‍🤝‍🧑' },
  { value: 100, suffix: '%', label: 'Type-Safe', icon: '🛡️' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden">
      {/* Nav */}
      <nav className="border-b border-slate-200/50 bg-white/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white grid place-items-center font-extrabold text-sm shadow-lg shadow-brand-500/30">D</div>
            <span className="font-extrabold text-slate-900 tracking-tight text-lg">Dayflow</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition px-3 py-2">Sign in</Link>
            <Link to="/signup" className="bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/25 transition-all hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.3),transparent_50%)]" />
        {/* Floating orbs */}
        <div className="absolute top-20 left-[15%] w-72 h-72 bg-white/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-[10%] w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-20 md:pb-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 text-sm font-semibold text-white mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-success-400 animate-pulse" />
              Production-ready HRMS · PostgreSQL + FastAPI + React
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.06]">
              Every workday,<br />
              <span className="bg-gradient-to-r from-brand-200 via-indigo-200 to-brand-100 bg-clip-text text-transparent">perfectly aligned.</span>
            </h1>
            <p className="mt-8 text-xl md:text-2xl text-white/75 max-w-2xl mx-auto leading-relaxed">
              Manage employees, attendance, leave approvals and payroll — all from one modern, secure platform.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link to="/signup" className="group bg-white text-brand-800 hover:bg-brand-50 shadow-2xl shadow-black/20 text-base font-bold px-10 py-4 rounded-2xl transition-all hover:shadow-3xl hover:-translate-y-1 flex items-center gap-2">
                Create account
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link to="/login" className="bg-white/10 border-2 border-white/25 hover:bg-white/20 text-white text-base font-bold px-10 py-4 rounded-2xl transition-all backdrop-blur-sm">
                Sign in to demo
              </Link>
            </div>
            <div className="mt-10 flex items-center justify-center gap-6 text-sm text-white/50">
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-success-400" /> No credit card</span>
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-success-400" /> Free forever</span>
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-success-400" /> Open source</span>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="relative -mt-16 pb-20 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <FloatingCard>
            <DashboardPreview />
          </FloatingCard>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl mb-2">{s.icon}</div>
                <div className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </div>
                <div className="text-sm text-slate-500 font-semibold mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-24">
        <div className="text-center mb-16">
          <div className="text-sm font-bold text-brand-600 uppercase tracking-widest mb-3">Features</div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Everything you need</h2>
          <p className="mt-4 text-slate-500 text-lg max-w-2xl mx-auto">Purpose-built for HR teams that care about accuracy, speed, and compliance.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <FloatingCard key={f.title} delay={i * 100}>
              <div className="group card card-body hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1 cursor-default">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} text-white grid place-items-center text-2xl shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{f.title}</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{f.desc}</p>
              </div>
            </FloatingCard>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15),transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-24">
          <div className="text-center mb-16">
            <div className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-3">Technology</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Built with real tech</h2>
            <p className="mt-4 text-slate-400 text-lg">No toy stack — production-grade from day one.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🐘', title: 'PostgreSQL', desc: '13 tables, CHECK constraints, JSONB, triggers, foreign keys', gradient: 'from-blue-500/20 to-blue-600/20 border-blue-500/30' },
              { icon: '⚡', title: 'FastAPI', desc: 'Async-ready, Pydantic validation, RBAC, rate limiting', gradient: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30' },
              { icon: '⚛️', title: 'React + Vite', desc: 'Responsive Tailwind UI, Recharts, real-time state', gradient: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30' },
              { icon: '🔐', title: 'JWT Auth', desc: 'Access + refresh tokens, bcrypt, account lockout', gradient: 'from-violet-500/20 to-violet-600/20 border-violet-500/30' },
            ].map((t) => (
              <div key={t.title} className={`rounded-2xl border bg-gradient-to-br ${t.gradient} p-6 text-center hover:scale-105 transition-transform`}>
                <div className="text-4xl mb-4">{t.icon}</div>
                <div className="font-bold text-xl mb-2">{t.title}</div>
                <div className="text-sm text-slate-400 leading-relaxed">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8 py-24 text-center text-white">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Ready to get started?</h2>
          <p className="mt-4 text-white/70 text-xl">Set up your team in minutes, not months.</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup" className="bg-white text-brand-800 hover:bg-brand-50 shadow-2xl text-base font-bold px-10 py-4 rounded-2xl transition-all hover:-translate-y-1">
              Create account →
            </Link>
            <Link to="/login" className="bg-white/10 border-2 border-white/25 hover:bg-white/20 text-white text-base font-bold px-10 py-4 rounded-2xl transition-all">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 text-white grid place-items-center font-extrabold text-[10px]">D</div>
            <span>© {new Date().getFullYear()} Dayflow HRMS — Odoo Hackathon</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-600">PostgreSQL</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">FastAPI</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">React</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
