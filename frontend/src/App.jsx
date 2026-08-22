import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppLayout from './components/layout/AppLayout.jsx'

import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import VerifyPage from './pages/VerifyPage.jsx'
import EmployeeDashboard from './pages/dashboard/EmployeeDashboard.jsx'
import AdminDashboard from './pages/dashboard/AdminDashboard.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import AttendancePage from './pages/AttendancePage.jsx'
import LeavePage from './pages/LeavePage.jsx'
import PayrollPage from './pages/PayrollPage.jsx'
import EmployeesPage from './pages/admin/EmployeesPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import AIAssistantPage from './pages/AIAssistantPage.jsx'
import AuditLogsPage from './pages/admin/AuditLogsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify" element={<VerifyPage />} />

      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<RoleRoute employee={<EmployeeDashboard />} admin={<AdminDashboard />} />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="ai-assistant" element={<AIAssistantPage />} />

        <Route path="admin/employees" element={<AdminOnly><EmployeesPage /></AdminOnly>} />
        <Route path="admin/audit" element={<AdminOnly><AuditLogsPage /></AdminOnly>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function RoleRoute({ employee, admin }) {
  return (
    <ProtectedRoute>
      {(['admin', 'hr'].includes(JSON.parse(localStorage.getItem('dayflow:user') || '{}').role || 'employee')
        ? admin : employee)}
    </ProtectedRoute>
  )
}

function AdminOnly({ children }) {
  const user = JSON.parse(localStorage.getItem('dayflow:user') || '{}')
  if (!(['admin', 'hr'].includes(user.role))) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
