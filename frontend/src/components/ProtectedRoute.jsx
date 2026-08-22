import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { user, accessToken } = useAuth()
  const location = useLocation()
  if (!user || !accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}
