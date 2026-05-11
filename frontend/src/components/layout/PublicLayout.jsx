/**
 * PublicLayout — wrapper for all unauthenticated public-facing pages.
 *
 * Renders a minimal government-style header with BDA branding and a
 * "Staff Login" link, then the page content, then a simple footer.
 * No sidebar — no auth required.
 */

import { Outlet, Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-blue-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link to="/public" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold tracking-wide">BDA LMIS</div>
              <div className="text-blue-200 text-xs">भूमि प्रबंधन सूचना प्रणाली</div>
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-6">
            <Link
              to="/public"
              className="text-blue-100 hover:text-white text-sm transition"
            >
              Colony Dashboard
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition"
            >
              <LogIn className="w-4 h-4" />
              Staff Login
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        © 2025 Bharatpur Development Authority, Rajasthan &nbsp;·&nbsp; भरतपुर विकास प्राधिकरण
      </footer>
    </div>
  )
}
