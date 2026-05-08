import { clsx } from 'clsx'
import { getPlotStatus, getPattaStatus } from '@/lib/plotStatus'

export function Badge({ className, children, color }) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      color, className
    )}>
      {children}
    </span>
  )
}

export function PlotStatusBadge({ status }) {
  const s = getPlotStatus(status)
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
      s.color
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

export function PattaStatusBadge({ status }) {
  const s = getPattaStatus(status)
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      s.color
    )}>
      {s.label}
    </span>
  )
}
