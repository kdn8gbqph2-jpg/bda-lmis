import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, MapPin, Grid3x3, FileText,
  FolderOpen, Users, ClipboardList, LogOut, Building2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/colonies',      icon: MapPin,           label: 'Colonies' },
  { to: '/plots',         icon: Grid3x3,          label: 'Plots' },
  { to: '/patta-ledger',  icon: FileText,         label: 'Patta Ledger' },
  { to: '/documents',     icon: FolderOpen,       label: 'Documents' },
]

const ADMIN_NAV = [
  { to: '/admin/users',      icon: Users,          label: 'Users' },
  { to: '/admin/audit-logs', icon: ClipboardList,  label: 'Audit Logs' },
]

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-blue-700 text-white'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </NavLink>
  )
}

export function Sidebar() {
  const { user, logout, isAdmin } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-64 shrink-0 bg-slate-900 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">BDA LMIS</p>
            <p className="text-slate-400 text-xs">Bharatpur</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map((item) => <NavItem key={item.to} {...item} />)}

        {isAdmin() && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Administration
              </p>
            </div>
            {ADMIN_NAV.map((item) => <NavItem key={item.to} {...item} />)}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email}
            </p>
            <p className="text-slate-400 text-xs capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
