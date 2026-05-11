/**
 * TopNavbar — sticky top bar for the public portal.
 *
 * Houses the global colony search, notification bell placeholder,
 * and a Staff Login chip on the right (desktop only — sidebar shows
 * a button on mobile).
 *
 * Props:
 *   onMenuClick   () => void — opens the mobile sidebar drawer
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Bell, LogIn, Menu, ChevronRight } from 'lucide-react'

export function TopNavbar({ onMenuClick }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/public/colonies?search=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="flex items-center gap-3 h-14 px-4 sm:px-6">

        {/* Mobile menu trigger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb / title — desktop only */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
          <Link to="/public" className="hover:text-slate-700 transition">Public Portal</Link>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-700 font-medium">Dashboard</span>
        </div>

        {/* Search — center, grows to fill */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search colonies, schemes, layouts…"
              className="w-full pl-9 pr-4 py-2 text-sm
                         bg-slate-50 border border-slate-200 rounded-lg
                         placeholder:text-slate-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500/20
                         focus:border-blue-400 focus:bg-white transition"
            />
          </div>
        </form>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700
                       transition relative"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
          </button>

          <Link
            to="/login"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5
                       text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100
                       rounded-lg border border-blue-100 transition"
          >
            <LogIn className="w-3.5 h-3.5" />
            Staff Login
          </Link>
        </div>
      </div>
    </header>
  )
}
