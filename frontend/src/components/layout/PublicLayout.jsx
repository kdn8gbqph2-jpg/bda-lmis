/**
 * PublicLayout — modern dashboard shell for the public portal.
 *
 * Architecture:
 *   ┌────────────┬──────────────────────────────────────────────┐
 *   │            │  TopNavbar (sticky, search + actions)        │
 *   │  Sidebar   ├──────────────────────────────────────────────┤
 *   │            │  <Outlet /> — page content (scrolls)         │
 *   └────────────┴──────────────────────────────────────────────┘
 *
 * The sidebar is fixed on desktop (≥ lg) and slides in as a drawer
 * on mobile.  Active links get a colored left border + tinted background.
 */

import { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard, List, LogIn, X, ChevronRight,
} from 'lucide-react'

import { TopNavbar } from '@/components/public/TopNavbar'
import { CATEGORIES } from '@/components/public/categories'

// ── Sidebar component ──────────────────────────────────────────────────────────

function SidebarContent({ onClose }) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">

      {/* ── Brand ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
        <Link to="/public" onClick={onClose} className="flex items-center gap-2.5 group min-w-0">
          <img
            src="/bda-logo.png"
            alt="BDA"
            className="w-10 h-10 object-contain flex-shrink-0 drop-shadow-sm
                       group-hover:scale-105 transition-transform"
          />
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition leading-tight truncate">
              BDA LMIS
            </div>
            <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider leading-tight mt-0.5">
              Public Portal
            </div>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-slate-400 hover:bg-slate-100 transition"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3">

        {/* Section: Overview */}
        <SectionLabel>Overview</SectionLabel>
        <NavItem
          to="/public"
          end
          icon={LayoutDashboard}
          label="Dashboard"
          labelHi="डैशबोर्ड"
          color="blue"
          onClose={onClose}
        />

        {/* Section: Colony Categories */}
        <SectionLabel>Colony Categories</SectionLabel>
        {CATEGORIES.map((cat) => (
          <NavItem
            key={cat.value}
            to={`/public/colonies?colony_type=${cat.value}`}
            icon={cat.icon}
            label={cat.label}
            labelHi={cat.labelHi}
            color={cat.color}
            onClose={onClose}
          />
        ))}

        {/* Section: Browse */}
        <SectionLabel>Browse</SectionLabel>
        <NavItem
          to="/public/colonies"
          end
          icon={List}
          label="All Colonies"
          labelHi="सभी कॉलोनियाँ"
          color="slate"
          onClose={onClose}
        />
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-100">
        <Link
          to="/login"
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full px-3 py-2
                     bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium
                     rounded-lg transition shadow-sm"
        >
          <LogIn className="w-4 h-4" />
          Staff Login
        </Link>
        <p className="text-[10px] text-slate-400 text-center mt-3 leading-tight">
          © 2025 Bharatpur Development Authority
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div className="px-4 pt-4 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
      {children}
    </div>
  )
}

// Per-color active styles. Use static class strings so Tailwind's JIT picks them up.
const ACTIVE_STYLES = {
  blue:    { bar: 'bg-blue-500',    bg: 'bg-blue-50/70',    text: 'text-blue-700',    icon: 'text-blue-600'    },
  emerald: { bar: 'bg-emerald-500', bg: 'bg-emerald-50/70', text: 'text-emerald-700', icon: 'text-emerald-600' },
  amber:   { bar: 'bg-amber-500',   bg: 'bg-amber-50/70',   text: 'text-amber-700',   icon: 'text-amber-600'   },
  orange:  { bar: 'bg-orange-500',  bg: 'bg-orange-50/70',  text: 'text-orange-700',  icon: 'text-orange-600'  },
  red:     { bar: 'bg-red-500',     bg: 'bg-red-50/70',     text: 'text-red-700',     icon: 'text-red-600'     },
  slate:   { bar: 'bg-slate-400',   bg: 'bg-slate-100',     text: 'text-slate-800',   icon: 'text-slate-600'   },
}

function NavItem({ to, end, icon: Icon, label, labelHi, color = 'slate', onClose }) {
  const s = ACTIVE_STYLES[color] ?? ACTIVE_STYLES.slate

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      className={({ isActive }) =>
        `relative flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm
         transition-all duration-150 group
         ${isActive
            ? `${s.bg} font-medium`
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`
      }
    >
      {({ isActive }) => (
        <>
          {/* Left active-border indicator */}
          {isActive && (
            <motion.span
              layoutId="public-nav-active"
              className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full ${s.bar}`}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <Icon
            className={`w-4 h-4 flex-shrink-0 transition-colors
                        ${isActive ? s.icon : 'text-slate-400 group-hover:text-slate-600'}`}
            strokeWidth={2}
          />
          <div className="min-w-0 flex-1">
            <div className={`truncate leading-tight ${isActive ? s.text : ''}`}>{label}</div>
            <div className="text-[10px] text-slate-400 truncate leading-tight">{labelHi}</div>
          </div>
          <ChevronRight
            className={`w-3 h-3 transition
                        ${isActive ? 'text-slate-400' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}
          />
        </>
      )}
    </NavLink>
  )
}

// ── Root layout ────────────────────────────────────────────────────────────────

export function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Desktop sidebar (≥ lg) */}
      <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              className="absolute left-0 top-0 h-full w-60 flex flex-col z-50 shadow-2xl"
            >
              <SidebarContent onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNavbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
