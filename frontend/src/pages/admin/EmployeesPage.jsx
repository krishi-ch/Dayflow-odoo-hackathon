import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { extractError } from '../../utils/api.js'
import { toast } from '../../components/Toast.jsx'
import StatCard from '../../components/StatCard.jsx'
import Avatar from '../../components/Avatar.jsx'
import { formatDate, yyyy_mm_dd } from '../../utils/formatters.js'

export default function EmployeesPage() {
  const [list, setList] = useState([])
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newProfile, setNewProfile] = useState({
    user_id: '',
    first_name: '', last_name: '', date_of_birth: '', gender: 'Male',
    phone: '', address: '', city: 'Bengaluru', state: 'Karnataka', country: 'India', zip_code: '',
    emergency_contact: '', emergency_relation: '',
    job_title: '', department: '', joining_date: yyyy_mm_dd(),
    employment_type: 'full_time', work_location: 'HQ',
    pan_number: '', aadhaar_number: '', bank_account: '', ifsc_code: '',
  })

  const load = async () => {
    try {
      const params = { limit: 200 }
      if (search) params.search = search
      if (dept) params.department = dept
      if (activeOnly) params.is_active = true
      const [{ data: p }, { data: u }] = await Promise.all([
        api.get('/employees', { params }),
        api.get('/employees', { params: { limit: 500 } }),
      ])
      setList(p); setUsers(u)
    } catch (e) { toast.error(extractError(e)) }
  }

  useEffect(() => { load() }, [search, dept, activeOnly])

  const departments = Array.from(new Set(users.map((u) => u.department).filter(Boolean)))
  const withoutProfiles = users.filter((u) => !list.find((l) => l.user_id === u.user_id))

  const saveProfile = async () => {
    if (!newProfile.user_id) { toast.warning('Select a user.'); return }
    if (!newProfile.first_name || !newProfile.job_title) { toast.warning('First name and Job title are required.'); return }
    try {
      await api.post('/employees', newProfile)
      toast.success('Profile created ✅')
      setShowCreate(false); load()
    } catch (e) { toast.error(extractError(e)) }
  }

  const toggleActive = async (p, active) => {
    try {
      await api.put(`/employees/${p.profile_id}`, { ...p, is_active: active })
      toast.success(`Employee ${active ? 'reactivated' : 'deactivated'}`)
      load()
    } catch (e) { toast.error(extractError(e)) }
  }

  return (
    <div className="space-y-6 animate-slideUp">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Admin workspace</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Employees</h1>
          <p className="mt-1 text-slate-500 text-sm">Manage employee profiles, roles, and account status.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Create profile</button>
      </header>

      <section className="grid md:grid-cols-4 gap-4">
        <StatCard title="Total profiles" value={list.length} icon="🧑‍🤝‍🧑" tone="brand" />
        <StatCard title="Departments" value={departments.length} icon="🏢" tone="violet" />
        <StatCard title="Missing profiles" value={withoutProfiles.length} icon="⚠️" tone="amber"
          hint="Users without employee records" />
        <StatCard title="Active" value={list.filter((e) => e.is_active).length} icon="✅" tone="green" />
      </section>

      <section className="card">
        <div className="p-4 md:p-5 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <input className="input md:w-80" placeholder="🔍 Search name or Employee ID..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input md:w-56" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700 select-none ml-auto">
            <input type="checkbox" className="w-4 h-4 accent-brand-600"
              checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            Active employees only
          </label>
        </div>
        <div className="overflow-x-auto">
          {list.length === 0 ? (
            <div className="py-14 text-center text-slate-500 text-sm">No employees match.</div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="table-head">
                  <th>Employee</th><th>Department</th><th>Title</th>
                  <th>Joining</th><th>Employment</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.profile_id} className="table-row">
                    <td>
                      <Avatar user={{ employee_id: p.user_id, role: 'employee' }} profile={p} />
                    </td>
                    <td>{p.department || '—'}</td>
                    <td className="font-semibold text-slate-800">{p.job_title}</td>
                    <td>{formatDate(p.joining_date)}</td>
                    <td><span className="badge-info">{p.employment_type}</span></td>
                    <td>
                      {p.is_active
                        ? <span className="badge-success">active</span>
                        : <span className="badge-muted">inactive</span>}
                    </td>
                    <td className="text-right">
                      {p.is_active
                        ? <button className="btn-ghost !py-1 text-warning-600" onClick={() => toggleActive(p, false)}>Disable</button>
                        : <button className="btn-ghost !py-1 text-success-600" onClick={() => toggleActive(p, true)}>Enable</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-auto card animate-slideUp">
            <div className="px-5 pt-5 flex items-start justify-between sticky top-0 bg-white z-10 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-xl">Create employee profile</h3>
                <p className="text-sm text-slate-500">Choose a registered user and fill in their employment details.</p>
              </div>
              <button className="btn-ghost" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="p-5 grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">User (registered account)</label>
                <select className="input" value={newProfile.user_id}
                  onChange={(e) => setNewProfile({ ...newProfile, user_id: e.target.value })}>
                  <option value="">— select user —</option>
                  {withoutProfiles.length
                    ? withoutProfiles.map((u) => (
                        <option key={u.user_id} value={u.user_id}>#{u.user_id} · {u.employee_id} · {u.email}</option>
                      ))
                    : users.map((u) => (
                        <option key={u.user_id} value={u.user_id}>#{u.user_id} · {u.employee_id} · {u.email}</option>
                      ))}
                </select>
              </div>
              {[
                ['first_name', 'First name'], ['last_name', 'Last name'],
                ['date_of_birth', 'Date of birth', 'date'], ['gender', 'Gender'],
                ['phone', 'Phone'], ['email', 'Work email (for ref only)'],
                ['city', 'City'], ['state', 'State'], ['country', 'Country'], ['zip_code', 'ZIP'],
                ['address', 'Address (line 1)'],
                ['emergency_contact', 'Emergency contact'], ['emergency_relation', 'Emergency relation'],
                ['job_title', 'Job title *'], ['department', 'Department'],
                ['joining_date', 'Joining date', 'date'], ['employment_type', 'Employment type'],
                ['work_location', 'Work location'],
                ['pan_number', 'PAN number'], ['aadhaar_number', 'Aadhaar number'],
                ['bank_account', 'Bank account number'], ['ifsc_code', 'IFSC code'],
              ].map(([k, label, type = 'text']) => (
                <div key={k}>
                  <label className="label">{label}</label>
                  <input type={type} className="input" value={newProfile[k] || ''}
                    onChange={(e) => setNewProfile({ ...newProfile, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 sticky bottom-0 bg-white">
              <button className="btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveProfile}>💾 Create profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
