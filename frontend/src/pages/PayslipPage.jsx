import React, { useEffect, useState, useCallback } from 'react'
import api, { extractError } from '../utils/api.js'
import { toast } from '../components/Toast.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatDate } from '../utils/formatters.js'

function PayslipPreview({ payslip, user }) {
  return (
    <div id="payslip-content" className="bg-white text-slate-900 p-8 rounded-xl border border-slate-200 shadow-lg max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b-2 border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white grid place-items-center text-xl font-extrabold shadow-lg">D</div>
          <div>
            <div className="text-xl font-extrabold text-slate-900">Dayflow Technologies</div>
            <div className="text-xs text-slate-500">Human Resource Management</div>
            <div className="text-xs text-slate-400">123 Tech Park, Bengaluru, India</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payslip</div>
          <div className="text-lg font-extrabold text-slate-900">
            {new Date(payslip.pay_year, payslip.pay_month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Employee Info */}
      <div className="grid grid-cols-2 gap-6 py-6 border-b border-slate-200">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Employee Details</div>
          <div className="text-sm"><span className="text-slate-500">Name:</span> <span className="font-bold">{payslip.employee_name || 'Employee'}</span></div>
          <div className="text-sm"><span className="text-slate-500">ID:</span> <span className="font-mono font-bold">{user?.employee_id || 'N/A'}</span></div>
          <div className="text-sm"><span className="text-slate-500">Email:</span> <span>{user?.email || 'N/A'}</span></div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Employment</div>
          <div className="text-sm"><span className="text-slate-500">Department:</span> <span className="font-bold">{payslip.department || 'General'}</span></div>
          <div className="text-sm"><span className="text-slate-500">Designation:</span> <span className="font-bold">{payslip.designation || 'Employee'}</span></div>
          <div className="text-sm"><span className="text-slate-500">Pay Period:</span> <span>{formatDate(`${payslip.pay_year}-${String(payslip.pay_month).padStart(2, '0')}-01`)}</span></div>
        </div>
      </div>

      {/* Salary Breakdown */}
      <div className="py-6 border-b border-slate-200">
        <div className="grid grid-cols-2 gap-8">
          {/* Earnings */}
          <div>
            <div className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3 pb-2 border-b border-green-200">Earnings</div>
            <div className="space-y-2">
              {(payslip.line_items || []).filter((l) => l.type === 'earning').map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.name}</span>
                  <span className="font-bold text-green-700">₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200 font-bold">
                <span className="text-slate-900">Gross Pay</span>
                <span className="text-green-700">₹{Number(payslip.gross_pay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <div className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3 pb-2 border-b border-red-200">Deductions</div>
            <div className="space-y-2">
              {(payslip.line_items || []).filter((l) => l.type === 'deduction').map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.name}</span>
                  <span className="font-bold text-red-600">-₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200 font-bold">
                <span className="text-slate-900">Total Deductions</span>
                <span className="text-red-600">-₹{Number(payslip.total_deductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Net Pay */}
      <div className="py-6 flex items-center justify-between">
        <div className="text-xs text-slate-500">This is a system-generated payslip and does not require a signature.</div>
        <div className="text-right">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Net Pay</div>
          <div className="text-3xl font-extrabold text-blue-700">
            ₹{Number(payslip.net_pay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
        Dayflow Technologies Pvt. Ltd. · This document is confidential and intended for the named employee only.
      </div>
    </div>
  )
}

export default function PayslipPage() {
  const { user } = useAuth()
  const [payslips, setPayslips] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/payroll/my').catch(() => ({ data: [] }))
      setPayslips(data || [])
      if (data?.length) setSelected(data[0])
    } catch (e) {
      toast.error(extractError(e, 'Failed to load payslips'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const downloadPDF = async () => {
    setDownloading(true)
    try {
      // Use browser print-to-PDF
      const content = document.getElementById('payslip-content')
      if (!content) { toast.error('No payslip to download'); return }

      const printWindow = window.open('', '_blank')
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payslip - ${user?.employee_id || 'Employee'}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', system-ui, sans-serif; padding: 20px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${content.outerHTML}
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
        </html>
      `)
      printWindow.document.close()
      toast.success('Print dialog opened — save as PDF')
    } catch (e) {
      toast.error('Failed to generate PDF')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <LoadingSpinner full text="Loading payslips…" />

  return (
    <div className="space-y-6 animate-slideUp">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">Payroll</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Payslips</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">View and download your salary slips</p>
        </div>
        {selected && (
          <button onClick={downloadPDF} disabled={downloading} className="btn-primary shadow-lg shadow-brand-500/25">
            {downloading ? '⏳ Generating…' : '📄 Download PDF'}
          </button>
        )}
      </div>

      {payslips.length === 0 ? (
        <div className="card card-body text-center py-16">
          <div className="text-5xl mb-4">💰</div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">No payslips yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your payslips will appear here once payroll is generated.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Payslip list */}
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">Available Payslips</h3>
            {payslips.map((p) => (
              <button
                key={p.payroll_id}
                onClick={() => setSelected(p)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selected?.payroll_id === p.payroll_id
                    ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-300 dark:border-brand-700 ring-2 ring-brand-400/30'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-200'
                }`}
              >
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {new Date(p.pay_year, p.pay_month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ₹{Number(p.net_pay || 0).toLocaleString('en-IN')}
                </div>
              </button>
            ))}
          </div>

          {/* Payslip preview */}
          <div className="lg:col-span-3">
            {selected ? (
              <PayslipPreview payslip={selected} user={user} />
            ) : (
              <div className="card card-body text-center py-16 text-slate-500">
                Select a payslip to preview
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
