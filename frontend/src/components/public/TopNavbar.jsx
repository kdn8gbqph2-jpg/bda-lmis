/**
 * TopNavbar — sticky top bar for the public portal.
 *
 * Logo + brand on the left (took over the role the removed sidebar
 * used to play), global colony search in the centre, notifications
 * bell + Officer Login on the right.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Bell, LogIn } from 'lucide-react'

export function TopNavbar() {
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

        {/* Brand — links back to the dashboard */}
        <Link to="/public" className="flex items-center gap-2.5 group flex-shrink-0">
          <img
            src="/bda-logo.png"
            alt="BDA"
            className="w-9 h-9 object-contain drop-shadow-sm
                       group-hover:scale-105 transition-transform duration-200"
          />
          <div className="hidden sm:block min-w-0 leading-tight">
            <div className="text-sm font-bold text-[#0F172A] truncate
                            group-hover:text-blue-700 transition-colors">
              BDA LMIS
            </div>
            <div className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider mt-0.5">
              Public Portal
            </div>
          </div>
        </Link>

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
