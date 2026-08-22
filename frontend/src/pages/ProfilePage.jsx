import React, { useEffect, useState } from 'react'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import Avatar from '../components/Avatar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatDate, profile_completion_pct } from '../utils/formatters.js'
import StatCard from '../components/StatCard.jsx'

const EMPLOYEE_SECTIONS = [
  {
    title: 'Personal details', fields: [
      { key: 'first_name', label: 'First name', type: 'text' },
      { key: 'last_name', label: 'Last name', type: 'text' },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date', adminOnly: true },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'], adminOnly: true },
    ],
  },
  {
    title: 'Contact', fields: [
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'zip_code', label: 'ZIP / Postal code', type: 'text' },
      { key: 'emergency_contact', label: 'Emergency contact', type: 'tel' },
      { key: 'emergency_relation', label: 'Emergency relation', type: 'text' },
    ],
  },
  {
    title: 'Employment details', adminOnly: true, fields: [
      { key: 'job_title', label: 'Job title', type: 'text' },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'joining_date', label: 'Joining date', type: 'date' },
      { key: 'employment_type', label: 'Employment type', type: 'select', options: ['full_time', 'part_time', 'contract', 'intern'] },
      { key: 'work_location', label: 'Work location', type: 'text' },
    ],
  },
  {
    title: 'Financial details', adminOnly: true, fields: [
      { key: 'pan_number', label: 'PAN number', type: 'text' },
      { key: 'aadhaar_number', label: 'Aadhaar number', type: 'text' },
      { key: 'bank_account', label: 'Bank account', type: 'text' },
      { key: 'ifsc_code', label: 'IFSC code', type: 'text' },
    ],
  },
]

export default function ProfilePage() {
  const { user, isAdmin } = useAuth()
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetch = async () => {
    try {
      const { data } = isAdmin
        ? await api.get(`/employees/${(await api.get('/employees/me')).data.profile_id}`)
        : await api.get('/employees/me')
      setProfile(data)
      setForm({ ...data })
    } catch (e) { toast.error(extractError(e)) }
  }

  useEffect(() => { fetch() }, [isAdmin])

  const completionPct = profile ? profile_completion_pct(profile) : 0

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const saveSelf = async () => {
    if (!profile) return
    setSaving(true)
    try {
      const payload = {
        address: form.address, phone: form.phone, profile_picture_url: form.profile_picture_url,
        city: form.city, state: form.state, country: form.country, zip_code: form.zip_code,
        emergency_contact: form.emergency_contact, emergency_relation: form.emergency_relation,
      }
      const { data } = await api.put('/employees/me', payload)
      setProfile(data); setForm({ ...data })
      toast.success('Profile updated ✅')
    } catch (e) { toast.error(extractError(e)) }
    finally { setSaving(false) }
  }

  const saveAdmin = async () => {
    if (!profile) return
    setSaving(true)
    try {
      const { data } = await api.put(`/employees/${profile.profile_id}`, form)
      setProfile(data); setForm({ ...data })
      toast.success('Profile saved (Admin edit) ✅')
    } catch (e) { toast.error(extractError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 animate-slideUp">
      <header>
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">My workspace</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">My profile</h1>
      </header>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="card card-body text-center relative overflow-hidden">
            <div className="h-24 -m-6 mb-0 bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900" />
            <div className="flex justify-center -mt-10 mb-3 relative z-10">
              <div className="ring-4 ring-white rounded-full">
                <Avatar size="xl" user={user} profile={profile} />
              </div>
            </div>
            <div className="font-extrabold text-xl text-slate-900">
              {profile ? `${profile.first_name} ${profile.last_name}` : user?.email}
            </div>
            <div className="text-sm text-slate-500">
              {profile?.job_title || '—'} · {profile?.department || '—'}
            </div>
            <div className="mt-2 inline-flex gap-2">
              <span className="badge-info">{profile?.employment_type || 'Employee'}</span>
              <span className="badge-muted">EID {user?.employee_id}</span>
            </div>
            <div className="mt-5">
              <label className="label text-left">Profile picture URL</label>
              <input className="input text-sm" placeholder="https://..."
                value={form.profile_picture_url || ''}
                onChange={(e) => setField('profile_picture_url', e.target.value)} />
            </div>
          </div>

          <StatCard title="Profile Completion" value={`${completionPct}%`}
            tone={completionPct > 80 ? 'green' : completionPct > 50 ? 'amber' : 'rose'}
            icon="📈"
            hint="A complete profile ensures accurate payroll and contactability" />

          <div className="card card-body space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Employee ID</span>
              <span className="font-mono font-semibold text-slate-800">{user?.employee_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-semibold text-slate-800 truncate ml-2">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Role</span>
              <span className="badge-info">{user?.role}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Joining</span>
              <span className="font-semibold text-slate-800">{formatDate(profile?.joining_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Account status</span>
              <span className={`badge ${profile?.is_active ? 'badge-success' : 'badge-muted'}`}>
                {profile?.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {EMPLOYEE_SECTIONS.map((sec) => {
            if (sec.adminOnly && !isAdmin) return null
            return (
              <div key={sec.title} className="card">
                <div className="px-5 pt-5 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">{sec.title}</h3>
                  {sec.adminOnly && <span className="badge-info">Admin editable</span>}
                </div>
                <div className="p-5 grid md:grid-cols-2 gap-4">
                  {sec.fields.map((f) => {
                    const disabled = f.adminOnly && !isAdmin
                    const v = form[f.key] ?? ''
                    const shared = 'w-full'
                    return (
                      <div key={f.key}>
                        <label className={`label ${disabled ? '!text-slate-500' : ''}`}>
                          {f.label}{disabled && <span className="ml-1 text-[10px] text-slate-400">(read-only)</span>}
                        </label>
                        {f.type === 'textarea' ? (
                          <textarea className="input" rows={2} value={v} disabled={disabled}
                            onChange={(e) => setField(f.key, e.target.value)} />
                        ) : f.type === 'select' ? (
                          <select className={`input ${shared}`} value={v} disabled={disabled}
                            onChange={(e) => setField(f.key, e.target.value)}>
                            <option value="">— select —</option>
                            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={f.type} className={`input ${shared}`} value={v} disabled={disabled}
                            onChange={(e) => setField(f.key, e.target.value)} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className="flex items-center justify-end gap-2">
            <button className="btn-outline" onClick={fetch}>↺ Reset</button>
            {isAdmin
              ? <button className="btn-primary" onClick={saveAdmin} disabled={saving}>{saving ? 'Saving…' : '💾 Save all changes (Admin)'}</button>
              : <button className="btn-primary" onClick={saveSelf} disabled={saving}>{saving ? 'Saving…' : '💾 Save changes'}</button>
            }
          </div>
        </div>
      </section>
    </div>
  )
}
