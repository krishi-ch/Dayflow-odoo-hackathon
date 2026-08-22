import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-7xl font-extrabold text-brand-700">404</div>
        <h1 className="text-2xl font-extrabold text-slate-900">That page took a day off.</h1>
        <p className="text-slate-500">The page you're looking for might be on leave, or never existed.</p>
        <Link to="/dashboard" className="btn-primary">Back to Dashboard →</Link>
      </div>
    </div>
  )
}
