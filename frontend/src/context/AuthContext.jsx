import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import api, { extractError } from '../utils/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dayflow:user') || 'null') } catch { return null }
  })
  const [accessToken, setAccessToken] = useState(localStorage.getItem('dayflow:access_token'))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) localStorage.setItem('dayflow:user', JSON.stringify(user))
    else localStorage.removeItem('dayflow:user')
  }, [user])
  useEffect(() => {
    if (accessToken) localStorage.setItem('dayflow:access_token', accessToken)
    else localStorage.removeItem('dayflow:access_token')
  }, [accessToken])
  const setRefresh = (t) => t
    ? localStorage.setItem('dayflow:refresh_token', t)
    : localStorage.removeItem('dayflow:refresh_token')

  const login = useCallback(async (email, password) => {
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('username', email)
      fd.append('password', password)
      const { data } = await api.post('/auth/login', fd)
      setUser(data.user)
      setAccessToken(data.access_token)
      setRefresh(data.refresh_token)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: extractError(e, 'Login failed') }
    } finally {
      setLoading(false)
    }
  }, [])

  const signup = useCallback(async (payload) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/signup', payload)
      return { ok: true, user: data }
    } catch (e) {
      return { ok: false, error: extractError(e, 'Signup failed') }
    } finally {
      setLoading(false)
    }
  }, [])

  const verifyEmail = useCallback(async (token) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/verify', { token })
      setUser(data.user)
      setAccessToken(data.access_token)
      setRefresh(data.refresh_token)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: extractError(e, 'Verification failed') }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
      return data
    } catch {
      return null
    }
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch {}
    setUser(null)
    setAccessToken(null)
    localStorage.removeItem('dayflow:refresh_token')
  }, [])

  const isAdmin = useMemo(() => ['admin', 'hr'].includes(user?.role), [user])

  const value = {
    user,
    accessToken,
    loading,
    isAdmin,
    login,
    signup,
    verifyEmail,
    fetchMe,
    logout,
    setUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
