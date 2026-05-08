import { clsx } from 'clsx'

export function Card({ children, className, padding = true }) {
  return (
    <div className={clsx(
      'bg-white rounded-xl border border-slate-200 shadow-sm',
      padding && 'p-5',
      className
    )}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-50 text-red-700',
    amber:  'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    slate:  'bg-slate-50 text-slate-600',
  }
  return (
    <Card className="flex items-start gap-4">
      {Icon && (
        <div className={clsx('p-2.5 rounded-lg', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-slate-500 truncate">{label}</p>
        <p className="text-2xl font-semibold text-slate-900 mt-0.5">
          {value ?? '—'}
        </p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}
