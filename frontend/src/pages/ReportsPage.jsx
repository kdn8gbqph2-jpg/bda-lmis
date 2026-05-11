import { BarChart3 } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Reports</h2>
      <p className="text-slate-500 text-sm max-w-sm">
        Colony-wise patta reports, regulation file status summaries and
        export-to-Excel functionality will be available here.
      </p>
    </div>
  )
}
