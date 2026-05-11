import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Building2, Grid3x3, FileText,
  FolderOpen, Users, ClipboardList, LogOut, Map, BarChart3,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/colonies',     icon: Building2,       label: 'Colonies'     },
  { to: '/plots',        icon: Grid3x3,         label: 'Plots'        },
  { to: '/map',          icon: Map,             label: 'Map'          },
  { to: '/patta-ledger', icon: FileText,        label: 'Patta Ledger' },
  { to: '/documents',    icon: FolderOpen,      label: 'Documents'    },
  { to: '/reports',      icon: BarChart3,       label: 'Reports'      },
]

const ADMIN_NAV = [
  { to: '/admin/users',      icon: Users,         label: 'Users'      },
  { to: '/admin/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
]

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => clsx(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-blue-700 text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      )}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      {label}
    </NavLink>
  )
}

export function Sidebar() {
  const { user, logout, isAdmin } = useAuthStore()
  const navigate = useNavigate()

  const initials = user?.first_name
    ? (user.first_name[0] + (user.last_name?.[0] || '')).toUpperCase()
    : (user?.email?.[0] || 'U').toUpperCase()

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.email

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-60 shrink-0 bg-slate-900 flex flex-col h-screen sticky top-0">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <img
            src="/bda-logo.png"
            alt="BDA"
            className="w-9 h-9 object-contain shrink-0 drop-shadow"
          />
          <div>
            <p className="text-white font-bold text-sm leading-tight">BDA LMIS</p>
            <p className="text-slate-400 text-xs leading-tight">Bharatpur Dev. Auth.</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map((item) => <NavItem key={item.to} {...item} />)}

        {isAdmin() && (
          <>
            <div className="pt-3 mt-3 border-t border-slate-700/60">
              <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Admin
              </p>
            </div>
            {ADMIN_NAV.map((item) => <NavItem key={item.to} {...item} />)}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-700/60">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">{displayName}</p>
            <p className="text-slate-400 text-xs capitalize">{user?.role || 'staff'}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
