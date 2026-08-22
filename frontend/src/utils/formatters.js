export const formatDate = (d, opts) => {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-IN', opts || { year: 'numeric', month: 'short', day: 'numeric' })
}

export const formatDateTime = (d) => {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export const formatMoney = (n) => {
  if (n === null || n === undefined || n === '') return '—'
  const num = Number(n)
  if (Number.isNaN(num)) return '—'
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

export const formatTime = (t) => {
  if (!t) return '—'
  if (typeof t === 'string' && t.includes(':')) {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = ((h + 11) % 12) + 1
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }
  return String(t)
}

export const minutesToHrs = (mins) => {
  if (!mins) return '0h'
  const h = Math.floor(Number(mins) / 60)
  const m = Number(mins) % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export const initials = (first, last) => {
  return `${(first || '?').charAt(0)}${(last || '').charAt(0)}`.toUpperCase()
}

export const statusBadge = (status) => {
  switch (status) {
    case 'present':
    case 'approved':
    case 'generated':
    case 'success':
      return 'badge-success'
    case 'absent':
    case 'rejected':
    case 'failed':
      return 'badge-danger'
    case 'half_day':
      return 'badge-warning'
    case 'leave':
    case 'pending':
      return 'badge-info'
    case 'archived':
    case 'inactive':
      return 'badge-muted'
    default:
      return 'badge-info'
  }
}

export const yyyy_mm_dd = (d = new Date()) => {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

export const addDays = (d, n) => {
  const date = new Date(typeof d === 'string' ? d : d)
  date.setDate(date.getDate() + n)
  return date
}

/**
 * Compute profile completion percentage from an employee profile object.
 * Mirrors backend/app/utils/helpers.py profile_completion_percent.
 */
export const profile_completion_pct = (profile) => {
  if (!profile) return 0
  const fields = [
    'first_name', 'last_name', 'date_of_birth', 'gender',
    'phone', 'address', 'emergency_contact', 'job_title',
    'department', 'joining_date', 'pan_number', 'aadhaar_number',
    'bank_account', 'ifsc_code', 'profile_picture_url',
  ]
  const filled = fields.filter((f) => profile[f]).length
  return Math.round((filled / fields.length) * 100)
}
