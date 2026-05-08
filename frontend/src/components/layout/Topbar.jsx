import React from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const ROUTE_LABELS = {
  '/dashboard':        'Dashboard',
  '/colonies':         'Colonies',
  '/plots':            'Plots',
  '/patta-ledger':     'Patta Ledger',
  '/documents':        'Documents',
  '/admin/users':      'User Management',
  '/admin/audit-logs': 'Audit Logs',
}

function useBreadcrumbs() {
  const { pathname } = useLocation()
  // Handle dynamic segments like /patta-ledger/:id
  const base = '/' + pathname.split('/').slice(1, 3).join('/')
  const parts = [{ label: 'Home', to: '/dashboard' }]
  const label = ROUTE_LABELS[pathname] || ROUTE_LABELS[base]
  if (label && pathname !== '/dashboard') parts.push({ label })
  return parts
}

function Clock() {
  const [now, setNow] = React.useState(new Date())
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="text-sm text-slate-500 tabular-nums">
      {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
      {' · '}
      {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

export function Topbar() {
  const breadcrumbs = useBreadcrumbs()
  const pageTitle = breadcrumbs[breadcrumbs.length - 1].label

  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex flex-col">
        <h1 className="text-base font-semibold text-slate-900 leading-tight">{pageTitle}</h1>
        <nav className="flex items-center gap-1 text-xs text-slate-400">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              <span className={i === breadcrumbs.length - 1 ? 'text-slate-600' : ''}>
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>
      <Clock />
    </header>
  )
}
