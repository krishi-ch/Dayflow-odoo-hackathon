import React, { useEffect, useState, useMemo } from 'react'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import Avatar from '../components/Avatar.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatDate, profile_completion_pct } from '../utils/formatters.js'

const TABS = [
  { key: 'resume', label: 'Resume', icon: '📄' },
  { key: 'private', label: 'Private Info', icon: '🔒' },
  { key: 'salary', label: 'Salary Info', icon: '💰', adminOnly: true },
]

// Salary component definitions matching wireframe
const DEFAULT_SALARY_COMPONENTS = [
  { name: 'Basic Salary', pct: 50, type: 'earning', base: 'wage' },
  { name: 'House Rent Allowance', pct: 50, type: 'earning', base: 'basic', desc: 'HRA is calculated based on the basic salary' },
  { name: 'Standard Allowance', pct: 16.67, type: 'earning', base: 'wage' },
  { name: 'Performance Bonus', pct: 8.33, type: 'earning', base: 'basic', desc: 'Variable amount paid during payroll' },
  { name: 'Leave Travel Allowance', pct: 8.33, type: 'earning', base: 'basic', desc: 'LTA is paid by the company to cover travel expenses' },
]

function ResumeTab({ profile, form, setField, isAdmin, saving, onSave }) {
  return (
    <div className="space-y-6">
      {/* About Section */}
      <div className="card">
        <div className="px-5 pt-5">
          <h3 className="font-bold text-slate-900">About</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label">Bio</label>
            <textarea
              className="input min-h-[80px]"
              value={form.bio || ''}
              disabled={!isAdmin}
              onChange={(e) => setField('bio', e.target.value)}
              placeholder="Tell us about yourself..."
            />
          </div>
          <div>
            <label className="label">What I love about my job</label>
            <textarea
              className="input min-h-[80px]"
              value={form.job_passion || ''}
              disabled={!isAdmin}
              onChange={(e) => setField('job_passion', e.target.value)}
              placeholder="Share what motivates you..."
            />
          </div>
          <div>
            <label className="label">Interests and Hobbies</label>
            <textarea
              className="input min-h-[60px]"
              value={form.interests || ''}
              disabled={!isAdmin}
              onChange={(e) => setField('interests', e.target.value)}
              placeholder="Your interests outside work..."
            />
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="card">
        <div className="px-5 pt-5 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Skills</h3>
          {isAdmin && (
            <button className="btn-outline !py-1 text-xs">+ Add Skills</button>
          )}
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {(form.skills || ['Communication', 'Leadership', 'Problem Solving']).map((skill, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-sm font-semibold border border-brand-100">
                {skill}
              </span>
            ))}
          </div>
          {(!form.skills || form.skills.length === 0) && (
            <p className="text-sm text-slate-500">No skills added yet.</p>
          )}
        </div>
      </div>

      {/* Certifications */}
      <div className="card">
        <div className="px-5 pt-5 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Certifications</h3>
          {isAdmin && (
            <button className="btn-outline !py-1 text-xs">+ Add Certification</button>
          )}
        </div>
        <div className="p-5">
          {(form.certifications || []).length === 0 ? (
            <p className="text-sm text-slate-500">No certifications added yet.</p>
          ) : (
            <div className="space-y-2">
              {form.certifications?.map((cert, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-lg">🏆</span>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{cert.name}</div>
                    <div className="text-xs text-slate-500">{cert.issuer} · {cert.year}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PrivateInfoTab({ profile, form, setField, isAdmin }) {
  return (
    <div className="card">
      <div className="px-5 pt-5">
        <h3 className="font-bold text-slate-900">Private Information</h3>
        <p className="text-sm text-slate-500 mt-1">Personal and bank details</p>
      </div>
      <div className="p-5">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Left Column: Personal */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">Personal Details</h4>
            {[
              ['date_of_birth', 'Date of Birth', 'date'],
              ['address', 'Residing Address', 'text'],
              ['country', 'Nationality', 'text'],
              ['email', 'Personal Email', 'email', true],
              ['gender', 'Gender', 'select', false, ['Male', 'Female', 'Other', 'Prefer not to say']],
              ['marital_status', 'Marital Status', 'select', false, ['Single', 'Married', 'Divorced', 'Widowed']],
              ['joining_date', 'Date of Joining', 'date', true],
            ].map(([key, label, type, disabled, options]) => (
              <div key={key}>
                <label className="label">{label}</label>
                {type === 'select' ? (
                  <select
                    className="input"
                    value={form[key] || ''}
                    disabled={disabled || !isAdmin}
                    onChange={(e) => setField(key, e.target.value)}
                  >
                    <option value="">— select —</option>
                    {options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={type}
                    className="input"
                    value={form[key] || ''}
                    disabled={disabled || !isAdmin}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Right Column: Bank Details */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">Bank Details</h4>
            {[
              ['bank_account', 'Account Number'],
              ['bank_name', 'Bank Name'],
              ['ifsc_code', 'IFSC Code'],
              ['pan_number', 'PAN No'],
              ['uan_number', 'UAN No'],
              ['employee_code', 'Emp Code'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="input"
                  value={form[key] || ''}
                  disabled={!isAdmin}
                  onChange={(e) => setField(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SalaryInfoTab({ profile }) {
  const [structures, setStructures] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/payroll/structures/employee/${profile.user_id}`)
        setStructures(data)
      } catch {}
      setLoading(false)
    }
    if (profile?.user_id) load()
  }, [profile?.user_id])

  const latestStructure = structures[0]
  const wage = latestStructure ? Number(latestStructure.base_salary) : 0
  const components = latestStructure?.components || []

  if (loading) return <LoadingSpinner text="Loading salary info…" />
  if (!latestStructure) return (
    <div className="card card-body text-center py-12 text-slate-500">
      No salary structure defined yet. Ask HR/Admin to create one.
    </div>
  )

  // Calculate derived values
  const basicComp = components.find((c) => c.component_name.toLowerCase().includes('basic'))
  const basicAmount = basicComp ? Number(basicComp.amount) : wage * 0.5

  const workingDays = 26
  const breakTime = '01:00'

  return (
    <div className="space-y-6">
      {/* Wage Summary */}
      <div className="card">
        <div className="p-5 grid md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Month Wage</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">₹{wage.toLocaleString('en-IN')} <span className="text-sm text-slate-500 font-semibold">/Month</span></div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Yearly Wage</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">₹{(wage * 12).toLocaleString('en-IN')} <span className="text-sm text-slate-500 font-semibold">/Yearly</span></div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Working Days/Week</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{workingDays}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Break Time</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{breakTime} <span className="text-sm text-slate-500 font-semibold">/hrs</span></div>
          </div>
        </div>
      </div>

      {/* Salary Components */}
      <div className="card">
        <div className="px-5 pt-5">
          <h3 className="font-bold text-slate-900">Salary Components</h3>
          <p className="text-sm text-slate-500 mt-1">All amounts calculated automatically from the defined wage</p>
        </div>
        <div className="p-5">
          <div className="space-y-4">
            {components.map((comp) => {
              const amt = Number(comp.amount)
              const total = comp.component_type === 'earning' ? wage : wage
              const pctVal = wage > 0 ? ((amt / wage) * 100).toFixed(2) : 0
              return (
                <div key={comp.component_id} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-slate-800">{comp.component_name}</div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-extrabold text-slate-900">₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500">/ month</span></span>
                      <span className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">{pctVal}%</span>
                    </div>
                  </div>
                  {comp.is_percentage && (
                    <div className="text-xs text-slate-500 mt-1">
                      {comp.component_type === 'earning' ? 'Earning' : 'Deduction'} · {Number(comp.amount)}% {comp.percentage_of ? `of component #${comp.percentage_of}` : 'of wage'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* PF & Tax */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-5 pt-5">
            <h3 className="font-bold text-slate-900">Provident Fund (PF) Contribution</h3>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <div>
                <div className="font-semibold text-slate-800 text-sm">Employee</div>
                <div className="text-xs text-slate-500">PF is calculated based on the basic salary</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900">₹{(basicAmount * 0.12).toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500">/ month</span></div>
                <div className="text-xs text-brand-600 font-semibold">12.00%</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <div>
                <div className="font-semibold text-slate-800 text-sm">Employer</div>
                <div className="text-xs text-slate-500">PF is calculated based on the basic salary</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900">₹{(basicAmount * 0.12).toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500">/ month</span></div>
                <div className="text-xs text-brand-600 font-semibold">12.00%</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="px-5 pt-5">
            <h3 className="font-bold text-slate-900">Tax Deductions</h3>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <div>
                <div className="font-semibold text-slate-800 text-sm">Professional Tax</div>
                <div className="text-xs text-slate-500">Professional Tax deducted from the Gross salary</div>
              </div>
              <div className="font-bold text-slate-900">₹200.00 <span className="text-xs text-slate-500">/ month</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user, isAdmin } = useAuth()
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('resume')
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    try {
      const { data } = isAdmin
        ? await api.get(`/employees/${(await api.get('/employees/me')).data.profile_id}`)
        : await api.get('/employees/me')
      setProfile(data)
      setForm({ ...data })
    } catch (e) { toast.error(extractError(e)) }
    setLoading(false)
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

  if (loading) return <LoadingSpinner full text="Loading profile…" />
  if (!profile) return <div className="text-center py-12 text-slate-500">Profile not found.</div>

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin)

  return (
    <div className="space-y-6 animate-slideUp">
      {/* Profile Header Card */}
      <div className="card overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900" />
        <div className="px-6 pb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10 relative z-10">
            <div className="ring-4 ring-white rounded-full">
              <Avatar size="xl" user={user} profile={profile} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold text-slate-900">
                {profile.first_name} {profile.last_name}
              </h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
                <span className="font-mono">{user?.employee_id}</span>
                <span>·</span>
                <span>{profile.job_title}</span>
                <span>·</span>
                <span>{user?.email}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-slate-500">Profile completion</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${completionPct > 80 ? 'bg-success-500' : completionPct > 50 ? 'bg-warning-500' : 'bg-danger-500'}`} style={{ width: `${completionPct}%` }} />
                </div>
                <span className="text-sm font-bold text-slate-700">{completionPct}%</span>
              </div>
            </div>
          </div>

          {/* Right side info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-sm">
            <div><span className="text-slate-500">Company</span><div className="font-semibold text-slate-800">Dayflow</div></div>
            <div><span className="text-slate-500">Department</span><div className="font-semibold text-slate-800">{profile.department || '—'}</div></div>
            <div><span className="text-slate-500">Manager</span><div className="font-semibold text-slate-800">{profile.manager_id || '—'}</div></div>
            <div><span className="text-slate-500">Location</span><div className="font-semibold text-slate-800">{profile.work_location || '—'}</div></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1 -mb-px overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'resume' && (
        <ResumeTab profile={profile} form={form} setField={setField} isAdmin={isAdmin} saving={saving} onSave={isAdmin ? saveAdmin : saveSelf} />
      )}
      {activeTab === 'private' && (
        <PrivateInfoTab profile={profile} form={form} setField={setField} isAdmin={isAdmin} />
      )}
      {activeTab === 'salary' && isAdmin && (
        <SalaryInfoTab profile={profile} />
      )}

      {/* Save Button for non-salary tabs */}
      {activeTab !== 'salary' && (
        <div className="flex items-center justify-end gap-2">
          <button className="btn-outline" onClick={fetch}>↺ Reset</button>
          {isAdmin
            ? <button className="btn-primary" onClick={saveAdmin} disabled={saving}>{saving ? 'Saving…' : '💾 Save all changes (Admin)'}</button>
            : <button className="btn-primary" onClick={saveSelf} disabled={saving}>{saving ? 'Saving…' : '💾 Save changes'}</button>
          }
        </div>
      )}
    </div>
  )
}
