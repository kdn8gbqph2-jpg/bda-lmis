import React from 'react'
import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'

const ROUTE_META = {
  '/dashboard':        { title: 'Dashboard',       sub: 'Overview of all colonies and land records' },
  '/colonies':         { title: 'Colonies',         sub: 'Manage colony and khasra records'          },
  '/plots':            { title: 'Plots',            sub: 'Browse and filter all plot records'         },
  '/map':              { title: 'Map',              sub: 'GIS map of colonies and plots'              },
  '/patta-ledger':     { title: 'Patta Ledger',     sub: 'All patta records and allottee details'     },
  '/documents':        { title: 'Documents',        sub: 'Scanned patta documents and DMS files'      },
  '/reports':          { title: 'Reports',          sub: 'Generate and download reports'              },
  '/admin/users':      { title: 'User Management',  sub: 'Manage system users and roles'              },
  '/admin/audit-logs': { title: 'Audit Logs',       sub: 'System audit trail and activity log'        },
}

function Clock() {
  const [now, setNow] = React.useState(new Date())
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const date = now.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
      <span className="font-medium text-slate-700">{date}</span>
      <span className="ml-2 text-slate-400">{time}</span>
    </div>
  )
}

export function Topbar() {
  const { pathname } = useLocation()
  // Handle dynamic segments like /patta-ledger/123
  const base = '/' + pathname.split('/').slice(1, 3).join('/')
  const meta = ROUTE_META[pathname] || ROUTE_META[base] || { title: 'BDA LMIS', sub: '' }

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-slate-800 font-semibold text-base leading-tight">{meta.title}</h1>
        {meta.sub && <p className="text-slate-400 text-xs mt-0.5">{meta.sub}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <Clock />
      </div>
    </header>
  )
}
