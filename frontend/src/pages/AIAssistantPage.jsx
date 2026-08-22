import React, { useEffect, useRef, useState } from 'react'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'

const SUGGESTIONS = [
  'Show my attendance today',
  'Attendance this week',
  'What is my leave balance?',
  'Show pending leave requests',
  'Latest salary / payslip',
  'Profile completion status',
  'Upcoming holidays',
]

export default function AIAssistantPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "👋 Hi! I'm Dayflow Assistant. Ask me about your attendance, leave balance, or payslip — in plain English!" },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  const send = async (text) => {
    const content = (text || input).trim()
    if (!content) return
    const userMsg = { role: 'user', content }
    setMessages((m) => [...m, userMsg])
    setInput(''); setLoading(true)
    try {
      const { data } = await api.post('/ai/chat', { messages: [...messages, userMsg] })
      setMessages((m) => [...m, { role: 'assistant', content: data.reply, data: data.data, intent: data.intent }])
    } catch (e) {
      toast.error(extractError(e, 'AI service unavailable'))
      setMessages((m) => [...m, { role: 'assistant', content: "⚠️ I couldn't reach the server right now. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  const renderContent = (msg) => {
    const lines = msg.content.split('\n').map((l, i) => <div key={i}>{l}</div>)
    if (!msg.data) return lines
    if (msg.intent === 'attendance_this_week' && Array.isArray(msg.data)) return lines
    if (msg.data && (msg.data.balances || msg.data.commands || msg.data.requests || msg.data.next_steps)) {
      return (
        <div>
          {lines}
          {msg.data.balances && (
            <div className="mt-3 rounded-xl border border-slate-100 bg-white overflow-hidden text-sm">
              <table className="w-full">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Available</th>
                    <th className="px-3 py-2 text-right">Used</th>
                    <th className="px-3 py-2 text-right">Entitled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(msg.data.balances).map(([k, v]) => (
                    <tr key={k}>
                      <td className="px-3 py-2 capitalize font-semibold text-slate-800">{k}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-bold">{v.available.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{v.used.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{v.entitled.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {msg.data.requests && (
            <div className="mt-3 space-y-1.5 text-sm">
              {msg.data.requests.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="font-semibold">#{r.id}</span> · <span className="capitalize">{r.leave_type}</span> · {r.from} to {r.to} ({r.days}d)
                </div>
              ))}
            </div>
          )}
          {msg.data.commands && (
            <ul className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
              {msg.data.commands.map((c) => (
                <li key={c} className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-brand-800 cursor-pointer hover:bg-brand-100 transition"
                  onClick={() => send(c)}>
                  💡 {c}
                </li>
              ))}
            </ul>
          )}
          {msg.data.next_steps && (
            <ul className="mt-3 space-y-1 text-sm">
              {msg.data.next_steps.map((h, i) => <li key={i} className="flex items-start gap-2"><span>•</span><span>{h}</span></li>)}
            </ul>
          )}
        </div>
      )
    }
    return lines
  }

  return (
    <div className="space-y-6 animate-slideUp h-[calc(100vh-10rem)] flex flex-col min-h-[600px]">
      <header>
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">AI Assistant</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Dayflow Assistant ✨</h1>
        <p className="mt-1 text-slate-500 text-sm">
          Natural language queries across your attendance, leave and payroll. Built with an intent-recognising layer with optional LLM.
        </p>
      </header>

      <div className="grid lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <aside className="hidden lg:block space-y-3">
          <div className="card card-body">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><span>⚡</span>Try these prompts</h4>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="w-full text-left rounded-xl border border-slate-100 hover:border-brand-300 hover:bg-brand-50/60 px-3 py-2.5 text-sm transition"
                  onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="card card-body bg-gradient-to-br from-slate-900 to-slate-800 text-white !border-0">
            <h4 className="font-bold mb-1 flex items-center gap-2"><span>🛡️</span>Privacy first</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Intents are resolved server-side against your data. No personal data is sent to external LLM unless you configure an API key.
            </p>
          </div>
        </aside>

        <div className="lg:col-span-3 card flex flex-col min-h-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <Avatar size="lg" user={user} profile={{ first_name: user?.email?.split('@')[0] }} />
            <div>
              <div className="font-bold text-slate-900">Chatting as <b>{user?.email}</b></div>
              <div className="text-xs text-slate-500">Role: <b>{user?.role}</b> · Employee ID: <b>{user?.employee_id}</b></div>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
            {messages.map((m, i) => (
              <div key={i} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-9 h-9 rounded-full shrink-0 grid place-items-center text-white font-bold shadow-card ${m.role === 'user' ? 'bg-gradient-to-br from-brand-500 to-brand-800' : 'bg-gradient-to-br from-slate-600 to-slate-800'}`}>
                  {m.role === 'user' ? 'U' : 'AI'}
                </div>
                <div className={`max-w-[80%] ${m.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm shadow-card ${m.role === 'user'
                    ? 'bg-brand-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'}
                  `}>
                    {renderContent(m)}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white grid place-items-center text-sm font-bold shadow-card">AI</div>
                <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white border border-slate-100 shadow-card">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 p-4">
            <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex gap-2">
              <input className="input" placeholder="Ask a question (e.g. what is my leave balance?)"
                value={input} onChange={(e) => setInput(e.target.value)} disabled={loading} />
              <button className="btn-primary" type="submit" disabled={loading || !input.trim()}>
                {loading ? '…' : 'Send →'}
              </button>
            </form>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.slice(0, 4).map((s) => (
                <button key={s} className="text-xs rounded-full bg-slate-100 hover:bg-brand-50 hover:text-brand-800 px-3 py-1 transition text-slate-600"
                  onClick={() => send(s)} disabled={loading}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
