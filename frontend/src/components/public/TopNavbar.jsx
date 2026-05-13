/**
 * TopNavbar — sticky top bar for the public portal.
 *
 * Houses the global colony search, notification bell placeholder,
 * and a Officer Login chip on the right (desktop only — sidebar shows
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

        {/* Search — center, grows to fill. Slightly elevated input with
            a muted icon chip on the left for better visual weight. */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-xl mx-auto">
          <div className="relative group">
            <span
              aria-hidden
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7
                         rounded-md bg-slate-100 text-slate-500
                         inline-flex items-center justify-center
                         group-focus-within:bg-blue-50 group-focus-within:text-blue-700
                         transition-colors"
            >
              <Search className="w-3.5 h-3.5" strokeWidth={2.25} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search colony, khasra, layout or scheme..."
              className="w-full pl-11 pr-4 py-2.5 text-sm text-slate-800
                         bg-white border border-slate-200 rounded-xl
                         shadow-[0_1px_2px_rgba(15,23,42,0.04)]
                         placeholder:text-slate-400
                         focus:outline-none focus:ring-4 focus:ring-blue-500/10
                         focus:border-blue-400 focus:shadow-[0_2px_8px_-2px_rgba(29,78,216,0.18)]
                         hover:border-slate-300 transition-all duration-200"
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
            className="inline-flex items-center gap-2 px-4 py-2
                       text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800
                       rounded-lg shadow-sm border border-blue-800/20 transition"
          >
            <LogIn className="w-5 h-5" strokeWidth={2.25} />
            <span className="hidden sm:inline">Officer Login</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
