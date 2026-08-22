import React, { useEffect, useState } from 'react'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import StatCard from '../components/StatCard.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatDate, formatMoney, statusBadge } from '../utils/formatters.js'

export default function PayrollPage() {
  const { user, isAdmin } = useAuth()
  const [tab, setTab] = useState(() => isAdmin ? 'runs' : 'my')
  const [myRecords, setMyRecords] = useState([])
  const [allRecords, setAllRecords] = useState([])
  const [structures, setStructures] = useState([])
  const [employees, setEmployees] = useState([])
  const [filter, setFilter] = useState({})
  const currentYear = new Date().getFullYear()
  const [run, setRun] = useState({
    month: new Date().getMonth() + 1,
    year: currentYear,
    user_ids: '',
  })

  const [showStructModal, setShowStructModal] = useState(false)
  const [struct, setStruct] = useState(() => ({
    user_id: '', effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '', base_salary: 50000,
    components: [
      { component_name: 'Basic Salary', component_type: 'earning', amount: 50000, is_percentage: false, percentage_of: undefined },
      { component_name: 'HRA', component_type: 'earning', amount: 40, is_percentage: true, percentage_of: 1 },
      { component_name: 'PF (Employee)', component_type: 'deduction', amount: 12, is_percentage: true, percentage_of: 1 },
    ],
  }))

  const refresh = async () => {
    try {
      const [{ data: mr }, { data: ar }, { data: ss }, { data: emps }] = await Promise.all([
        api.get('/payroll/my'),
        isAdmin ? api.get('/payroll/all', { params: filter }) : Promise.resolve({ data: [] }),
        isAdmin ? api.get('/payroll/structures/my') : Promise.resolve({ data: [] }),
        isAdmin ? api.get('/employees', { params: { limit: 200 } }) : Promise.resolve({ data: [] }),
      ])
      setMyRecords(mr); setAllRecords(ar); setStructures(ss); setEmployees(emps)
    } catch (e) { toast.error(extractError(e)) }
  }

  useEffect(() => { refresh() }, [tab, filter, isAdmin])

  const runPayroll = async () => {
    const params = {}
    if (run.user_ids) params.user_ids = run.user_ids
    try {
      const { data } = await api.post('/payroll/generate', { pay_month: run.month, pay_year: run.year }, { params })
      toast.success(`Generated ${data.length} payroll record(s) ✅`)
      refresh()
    } catch (e) { toast.error(extractError(e)) }
  }

  const exportCsv = async () => {
    try {
      const res = await api.get('/payroll/export.csv', {
        params: { month: filter.month || new Date().getMonth() + 1, year: filter.year || new Date().getFullYear() },
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payroll_${filter.year || new Date().getFullYear()}_${filter.month || new Date().getMonth() + 1}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV export ready')
    } catch (e) { toast.error(extractError(e)) }
  }

  const downloadPayslip = async (pid) => {
    try {
      const res = await api.get(`/payroll/${pid}/payslip.pdf`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (e) { toast.error(extractError(e)) }
  }

  const createStructure = async () => {
    if (!struct.user_id) { toast.warning('Select an employee'); return }
    const payload = { ...struct, user_id: Number(struct.user_id), base_salary: Number(struct.base_salary) }
    payload.components = struct.components.map((c) => ({
      ...c,
      amount: Number(c.amount),
      is_percentage: Boolean(c.is_percentage),
      percentage_of: c.percentage_of ? Number(c.percentage_of) : undefined,
    }))
    try {
      await api.post('/payroll/structures', payload)
      toast.success('Salary structure saved ✅')
      setShowStructModal(false); refresh()
    } catch (e) { toast.error(extractError(e)) }
  }

  const totalRow = (r) => {
    const lines = r.line_items || []
    const earn = lines.filter((l) => l.component_type === 'earning').reduce((s, l) => s + Number(l.amount), 0)
    const ded  = lines.filter((l) => l.component_type === 'deduction').reduce((s, l) => s + Number(l.amount), 0)
    return { earn, ded, net: earn - ded }
  }

  const PayslipCard = ({ r, employee }) => {
    const { earn, ded, net } = totalRow(r)
    return (
      <div className="card overflow-hidden animate-slideUp">
        <div className="px-5 pt-5 flex flex-wrap items-start justify-between gap-3 bg-gradient-to-br from-brand-700 to-brand-900 text-white">
          <div>
            <div className="text-xs uppercase tracking-widest text-brand-100 font-semibold">Payslip #{r.payroll_id}</div>
            <h3 className="font-extrabold text-2xl mt-1">{new Date(2000, r.pay_month - 1, 1).toLocaleString('en-US', { month: 'long' })} {r.pay_year}</h3>
            {employee && <div className="text-brand-100 text-sm mt-0.5">{employee}</div>}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.status === 'generated' ? 'bg-success-500 text-white' : 'bg-white/20 text-white'}`}>{r.status}</span>
        </div>
        <div className="p-5 grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Paid days</div>
            <div className="mt-0.5 text-2xl font-extrabold text-slate-900">{String(r.paid_days)} <span className="text-xs text-slate-500 font-semibold">/ LOP {String(r.lop_days)}</span></div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <div className="text-xs uppercase tracking-widest text-green-700 font-semibold">Total earnings</div>
            <div className="mt-0.5 text-2xl font-extrabold text-green-800">{formatMoney(r.total_earnings || earn)}</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <div className="text-xs uppercase tracking-widest text-rose-700 font-semibold">Total deductions</div>
            <div className="mt-0.5 text-2xl font-extrabold text-rose-800">{formatMoney(r.total_deductions || ded)}</div>
          </div>
        </div>
        <div className="px-5 pb-5 grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-bold uppercase text-slate-500 mb-1.5">Earnings</div>
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {(r.line_items || []).filter((l) => l.component_type === 'earning').map((l) => (
                <li key={l.line_item_id} className="px-3 py-2 text-sm flex items-center justify-between">
                  <span className="text-slate-700">{l.component_name}</span>
                  <span className="font-semibold text-green-700">+{formatMoney(l.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-500 mb-1.5">Deductions</div>
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {(r.line_items || []).filter((l) => l.component_type === 'deduction').map((l) => (
                <li key={l.line_item_id} className="px-3 py-2 text-sm flex items-center justify-between">
                  <span className="text-slate-700">{l.component_name}</span>
                  <span className="font-semibold text-rose-700">-{formatMoney(l.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl p-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-300 font-semibold">Net Salary</div>
              <div className="text-3xl font-extrabold mt-0.5">{formatMoney(r.net_salary || net)}</div>
            </div>
            <button className="btn bg-white text-slate-900 hover:bg-slate-100" onClick={() => downloadPayslip(r.payroll_id)}>⬇ Download PDF</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-slideUp">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Compensation</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Payroll & Salary</h1>
          <p className="mt-1 text-slate-500 text-sm">View your payslips. HR/Admin can generate payroll runs &amp; manage salary structures.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-outline" onClick={exportCsv}>⬇ Export CSV</button>
          {isAdmin && <button className="btn-primary" onClick={() => setShowStructModal(true)}>+ Salary structure</button>}
        </div>
      </header>

      {isAdmin && (
        <div className="card card-body flex flex-wrap items-center gap-3 p-3">
          <div className="flex rounded-xl bg-slate-100 p-1 flex-wrap">
            <button onClick={() => setTab('my')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'my' ? 'bg-white shadow-card text-slate-900' : 'text-slate-600'}`}>📄 My Payslips</button>
            <button onClick={() => setTab('runs')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'runs' ? 'bg-white shadow-card text-slate-900' : 'text-slate-600'}`}>🧾 Payroll runs</button>
            <button onClick={() => setTab('structures')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'structures' ? 'bg-white shadow-card text-slate-900' : 'text-slate-600'}`}>⚖️ Salary structures</button>
          </div>
          {tab === 'runs' && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select className="input !py-2" value={run.month} onChange={(e) => setRun({ ...run, month: Number(e.target.value) })}>
                {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' })}</option>)}
              </select>
              <select className="input !py-2" value={run.year} onChange={(e) => setRun({ ...run, year: Number(e.target.value) })}>
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => <option key={y}>{y}</option>)}
              </select>
              <input className="input !py-2" placeholder="User IDs (comma, optional)"
                value={run.user_ids} onChange={(e) => setRun({ ...run, user_ids: e.target.value })} />
              <button className="btn-primary" onClick={runPayroll}>▶ Run payroll</button>
            </div>
          )}
          {tab === 'runs' && (
            <div className="flex items-center gap-2">
              <select className="input !py-2" value={filter.month || ''} onChange={(e) => setFilter({ ...filter, month: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">Any month</option>
                {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' })}</option>)}
              </select>
              <select className="input !py-2" value={filter.year || ''} onChange={(e) => setFilter({ ...filter, year: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">Any year</option>
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {(tab === 'my' || !isAdmin) && (
        <>
          <section className="grid md:grid-cols-3 gap-4">
            <StatCard title="Payslips" value={myRecords.length} icon="🧾" tone="brand" hint="Total generated payslips" />
            <StatCard title="Latest Gross"
              value={formatMoney(myRecords[0]?.total_earnings)}
              icon="💵" tone="green" hint={myRecords[0] ? `${myRecords[0].pay_month}/${myRecords[0].pay_year}` : 'No payslips'} />
            <StatCard title="Latest Net"
              value={formatMoney(myRecords[0]?.net_salary)}
              icon="💰" tone="violet" hint={myRecords[0] ? `${myRecords[0].paid_days} paid days` : '—'} />
          </section>
          <section className="space-y-4">
            {myRecords.length === 0 && (
              <div className="card card-body text-center py-12 text-slate-500">
                📭 You don't have any payslips yet. Ask your HR to run payroll.
              </div>
            )}
            {myRecords.map((r) => (
              <PayslipCard key={r.payroll_id} r={r} />
            ))}
          </section>
        </>
      )}

      {tab === 'runs' && isAdmin && (
        <section className="card">
          <div className="px-5 pt-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">All payroll records</h3>
              <p className="text-sm text-slate-500">{allRecords.length} records</p>
            </div>
          </div>
          <div className="p-5 overflow-x-auto">
            {allRecords.length === 0 ? (
              <div className="py-10 text-sm text-slate-500 text-center bg-slate-50 rounded-xl">
                No payroll runs yet. Use "Run payroll" to generate payslips for the month.
              </div>
            ) : (
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="table-head">
                    <th>ID</th><th>Employee</th><th>Period</th><th>Paid / LOP</th>
                    <th>Earnings</th><th>Deductions</th><th>Net</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allRecords.map((r) => (
                    <tr key={r.payroll_id} className="table-row">
                      <td className="font-mono text-xs">#{r.payroll_id}</td>
                      <td className="font-semibold text-slate-800">{r.employee_name || `User ${r.user_id}`}</td>
                      <td>{r.pay_month}/{r.pay_year}</td>
                      <td>{r.paid_days} / <span className="text-rose-600">{r.lop_days}</span></td>
                      <td className="text-green-700 font-semibold">{formatMoney(r.total_earnings)}</td>
                      <td className="text-rose-700 font-semibold">{formatMoney(r.total_deductions)}</td>
                      <td className="font-bold text-slate-900">{formatMoney(r.net_salary)}</td>
                      <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                      <td>
                        <button className="btn-ghost !py-1 !px-2" onClick={() => downloadPayslip(r.payroll_id)}>⬇ PDF</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {tab === 'structures' && isAdmin && (
        <section className="card">
          <div className="px-5 pt-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Salary structures</h3>
              <p className="text-sm text-slate-500">Define base + components (HRA, PF, etc.) per employee with effective dates</p>
            </div>
          </div>
          <div className="p-5">
            {employees.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-6">Load employees first.</div>
            )}
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="table-head"><th>Employee</th><th>Effective From</th><th>Effective To</th><th>Base</th><th># Components</th></tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const empStructs = structures.filter((s) => s.user_id === e.user_id)
                  if (empStructs.length === 0) {
                    return (
                      <tr key={e.user_id} className="table-row">
                        <td className="font-semibold text-slate-800">{e.first_name} {e.last_name}</td>
                        <td colSpan="4" className="text-slate-500 text-sm">— no salary structure yet —</td>
                      </tr>
                    )
                  }
                  return empStructs.map((s) => (
                    <tr key={s.structure_id} className="table-row">
                      <td className="font-semibold text-slate-800">{s.employee_name || e.first_name + ' ' + e.last_name}</td>
                      <td>{formatDate(s.effective_from)}</td>
                      <td>{s.effective_to ? formatDate(s.effective_to) : '—'}</td>
                      <td className="font-semibold text-green-700">{formatMoney(s.base_salary)}</td>
                      <td>{s.components?.length || 0}</td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showStructModal && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 animate-slideUp">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-auto card animate-slideUp">
            <div className="px-5 pt-5 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-xl">Create salary structure</h3>
                <p className="text-sm text-slate-500">Percentage-based components refer to components by sequential ID (1 = first component).</p>
              </div>
              <button className="btn-ghost" onClick={() => setShowStructModal(false)}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Employee</label>
                  <select className="input" value={struct.user_id}
                    onChange={(e) => setStruct({ ...struct, user_id: e.target.value })}>
                    <option value="">— select employee —</option>
                    {employees.map((e) => <option key={e.user_id} value={e.user_id}>{e.first_name} {e.last_name} — {e.job_title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Base salary (₹)</label>
                  <input type="number" className="input" value={struct.base_salary}
                    onChange={(e) => setStruct({ ...struct, base_salary: e.target.value })} />
                </div>
                <div>
                  <label className="label">Effective from</label>
                  <input type="date" className="input" value={struct.effective_from}
                    onChange={(e) => setStruct({ ...struct, effective_from: e.target.value })} />
                </div>
                <div>
                  <label className="label">Effective to (optional)</label>
                  <input type="date" className="input" value={struct.effective_to}
                    onChange={(e) => setStruct({ ...struct, effective_to: e.target.value })} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900">Components</h4>
                  <button type="button" className="btn-outline !py-1"
                    onClick={() => setStruct({
                      ...struct,
                      components: [...struct.components, { component_name: 'New component', component_type: 'earning', amount: 0, is_percentage: false, percentage_of: 1 }]
                    })}>
                    + Add component
                  </button>
                </div>
                <div className="space-y-2">
                  {struct.components.map((c, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                      <div className="col-span-12 md:col-span-3">
                        <label className="text-xs text-slate-500 font-semibold">#{idx + 1} Name</label>
                        <input className="input !py-1.5" value={c.component_name}
                          onChange={(e) => { const cs = [...struct.components]; cs[idx].component_name = e.target.value; setStruct({ ...struct, components: cs }) }} />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <label className="text-xs text-slate-500 font-semibold">Type</label>
                        <select className="input !py-1.5" value={c.component_type}
                          onChange={(e) => { const cs = [...struct.components]; cs[idx].component_type = e.target.value; setStruct({ ...struct, components: cs }) }}>
                          <option value="earning">Earning</option>
                          <option value="deduction">Deduction</option>
                        </select>
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <label className="text-xs text-slate-500 font-semibold">Amount / %</label>
                        <input type="number" className="input !py-1.5" value={c.amount}
                          onChange={(e) => { const cs = [...struct.components]; cs[idx].amount = e.target.value; setStruct({ ...struct, components: cs }) }} />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <label className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                          <input type="checkbox" className="w-4 h-4 accent-brand-600" checked={!!c.is_percentage}
                            onChange={(e) => { const cs = [...struct.components]; cs[idx].is_percentage = e.target.checked; setStruct({ ...struct, components: cs }) }} />
                          Percentage-based
                        </label>
                        <input type="number" min="1" max={idx + 1} disabled={!c.is_percentage} className="input !py-1.5 mt-1"
                          placeholder="Ref component # (1-based)"
                          value={c.percentage_of ?? ''}
                          onChange={(e) => { const cs = [...struct.components]; cs[idx].percentage_of = e.target.value; setStruct({ ...struct, components: cs }) }} />
                      </div>
                      <div className="col-span-6 md:col-span-3 md:justify-end flex">
                        <button type="button" className="btn-danger !py-1.5"
                          onClick={() => setStruct({ ...struct, components: struct.components.filter((_, i) => i !== idx) })}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button className="btn-outline" onClick={() => setShowStructModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={createStructure}>💾 Save structure</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
