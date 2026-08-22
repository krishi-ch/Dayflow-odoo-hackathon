/**
 * Shared validation utilities for frontend forms.
 * Used by LoginPage, SignupPage, ProfilePage, LeavePage, and EmployeesPage.
 *
 * Each validator returns null on success, or an error message string.
 */

export const required = (label = 'This field') => (v) => {
  if (v === null || v === undefined) return `${label} is required`
  if (typeof v === 'string' && v.trim() === '') return `${label} is required`
  return null
}

export const minLength = (min, label) => (v) => {
  if (!v || v.length < min) return `${label || 'Field'} must be at least ${min} characters`
  return null
}

export const maxLength = (max, label) => (v) => {
  if (v && v.length > max) return `${label || 'Field'} must be at most ${max} characters`
  return null
}

export const email = (v) => {
  if (!v) return 'Email is required'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(v.trim())) return 'Enter a valid email address'
  return null
}

export const phone = (v) => {
  if (!v) return null // phone is optional in most forms
  const cleaned = v.replace(/[\s\-()]/g, '')
  if (!/^\+?\d{7,15}$/.test(cleaned)) return 'Enter a valid phone number'
  return null
}

export const dateNotFuture = (label = 'Date') => (v) => {
  if (!v) return null
  const d = new Date(v)
  if (d > new Date()) return `${label} cannot be in the future`
  return null
}

export const dateNotPast = (label = 'Date') => (v) => {
  if (!v) return null
  const d = new Date(v)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (d < today) return `${label} cannot be in the past`
  return null
}

export const dateRange = (startField, endField) => (values) => {
  const start = values[startField]
  const end = values[endField]
  if (start && end && new Date(end) < new Date(start)) {
    return { [endField]: 'End date must be on or after start date' }
  }
  return {}
}

export const passwordStrength = (v) => {
  if (!v) return { score: 0, errors: ['Password is required'] }
  const errors = []
  if (v.length < 8) errors.push('At least 8 characters')
  if (!/[A-Z]/.test(v)) errors.push('One uppercase letter')
  if (!/[a-z]/.test(v)) errors.push('One lowercase letter')
  if (!/[0-9]/.test(v)) errors.push('One digit')
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(v)) errors.push('One special character')
  const score = Math.round(((5 - errors.length) / 5) * 100)
  return { score, errors, valid: errors.length === 0 }
}

/**
 * Run multiple validators against a value and return the first error, or null.
 */
export const validate = (value, ...validators) => {
  for (const fn of validators) {
    const err = fn(value)
    if (err) return err
  }
  return null
}

/**
 * Validate an entire form object.
 * validators is a map: { fieldName: [fn1, fn2, ...] }
 * Returns { valid: boolean, errors: { fieldName: errorMsg } }
 */
export const validateForm = (values, validators) => {
  const errors = {}
  for (const [field, fns] of Object.entries(validators)) {
    const err = validate(values[field], ...fns)
    if (err) errors[field] = err
  }
  return { valid: Object.keys(errors).length === 0, errors }
}
