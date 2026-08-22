import React from 'react'

/**
 * Consistent loading spinner used across all pages.
 * Props:
 *   size    – 'sm' | 'md' | 'lg'   (default 'md')
 *   text    – optional label below the spinner
 *   full    – if true, fills parent area and centres itself
 *   className – extra Tailwind classes
 */
export default function LoadingSpinner({ size = 'md', text, full = false, className = '' }) {
  const dims = { sm: 'h-5 w-5 border-2', md: 'h-8 w-8 border-[3px]', lg: 'h-12 w-12 border-4' }

  const spinner = (
    <div className={`inline-flex flex-col items-center gap-3 ${className}`}>
      <div
        className={`rounded-full border-brand-200 border-t-brand-600 animate-spin ${dims[size] || dims.md}`}
        role="status"
        aria-label="Loading"
      />
      {text && <div className="text-sm text-slate-500 font-medium">{text}</div>}
    </div>
  )

  if (full) {
    return (
      <div className="flex items-center justify-center py-20 w-full">
        {spinner}
      </div>
    )
  }

  return spinner
}

/**
 * Inline skeleton loader for tables / cards.
 * Renders a pulsing placeholder that matches the card look.
 */
export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`card card-body space-y-3 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-100 rounded-full" style={{ width: `${60 + Math.random() * 30}%` }} />
      ))}
    </div>
  )
}

/**
 * Full-page skeleton for dashboard-style pages.
 */
export function PageSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-slate-100 rounded-lg" />
      <div className="h-4 w-72 bg-slate-100 rounded-lg" />
      <div className="grid md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card card-body h-28 bg-slate-50" />
        ))}
      </div>
      <div className="card card-body h-64 bg-slate-50" />
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="card card-body h-16 bg-slate-50" />
        ))}
      </div>
    </div>
  )
}
