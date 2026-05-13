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
  LayoutDashboard, List, X, ChevronRight,
} from 'lucide-react'

import { TopNavbar } from '@/components/public/TopNavbar'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { CATEGORIES } from '@/components/public/categories'
import { Backdrop } from '@/components/ui/Backdrop'

// ── Sidebar component ──────────────────────────────────────────────────────────

function SidebarContent({ onClose }) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">

      {/* ── Brand band ── shared portal Backdrop, tighter grid scale ── */}
      <div className="relative px-4 py-4 border-b border-slate-200/80 overflow-hidden">
        <Backdrop subtle gridSize={24} />
        <div className="relative flex items-center justify-between gap-2">
          <Link to="/public" onClick={onClose} className="flex items-center gap-2.5 group min-w-0">
            <img
              src="/bda-logo.png"
              alt="BDA"
              className="w-10 h-10 object-contain flex-shrink-0 drop-shadow-sm
                         group-hover:scale-105 transition-transform duration-200"
            />
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#0F172A] leading-tight truncate
                              group-hover:text-blue-700 transition-colors">
                BDA LMIS
              </div>
              <div className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider leading-tight mt-0.5">
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
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3">

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

        <SectionLabel>Colony Categories</SectionLabel>
        {CATEGORIES.map((cat) => (
          <NavItem
            key={cat.value}
            to={`/public/colonies?colony_type=${cat.value}`}
            icon={cat.icon}
            label={cat.sidebarLabel ?? cat.label}
            labelHi={cat.labelHi}
            color={cat.color}
            onClose={onClose}
          />
        ))}

        <SectionLabel>Browse</SectionLabel>
        <NavItem
          to="/public/colonies"
          end
          icon={List}
          label="Browse All"
          labelHi="सभी कॉलोनियाँ"
          color="slate"
          onClose={onClose}
        />
      </nav>

      {/* ── Footer chip in the sidebar — institutional note ── */}
      <div className="px-3 py-3 border-t border-slate-200/80">
        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mb-1">
          Government of Rajasthan
        </div>
        <div className="text-[11px] text-slate-500 leading-snug">
          Bharatpur Development Authority · GIS-Enabled
        </div>
      </div>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div className="px-4 pt-5 pb-2 text-[10px] font-semibold text-slate-400
                    uppercase tracking-[0.14em] flex items-center gap-2">
      <span>{children}</span>
      <span className="flex-1 h-px bg-slate-100" />
    </div>
  )
}

// Per-color nav styles. Static class strings so Tailwind's JIT picks them up.
// `chipBg` / `chipIcon` are used at idle to color-code each category icon;
// `activeBg` / `activeText` apply to the active row.
const NAV_STYLES = {
  blue:    { bar: 'bg-blue-500',    activeBg: 'bg-blue-50',    activeText: 'text-blue-700',    chipBg: 'bg-blue-50',    chipIcon: 'text-blue-600'    },
  emerald: { bar: 'bg-emerald-500', activeBg: 'bg-emerald-50', activeText: 'text-emerald-700', chipBg: 'bg-emerald-50', chipIcon: 'text-emerald-600' },
  amber:   { bar: 'bg-amber-500',   activeBg: 'bg-amber-50',   activeText: 'text-amber-700',   chipBg: 'bg-amber-50',   chipIcon: 'text-amber-600'   },
  orange:  { bar: 'bg-orange-500',  activeBg: 'bg-orange-50',  activeText: 'text-orange-700', chipBg: 'bg-orange-50',  chipIcon: 'text-orange-600'  },
  red:     { bar: 'bg-red-500',     activeBg: 'bg-red-50',     activeText: 'text-red-700',     chipBg: 'bg-red-50',     chipIcon: 'text-red-600'     },
  slate:   { bar: 'bg-slate-400',   activeBg: 'bg-slate-100',  activeText: 'text-slate-800',   chipBg: 'bg-slate-100',  chipIcon: 'text-slate-600'   },
}

function NavItem({ to, end, icon: Icon, label, labelHi, color = 'slate', onClose }) {
  const s = NAV_STYLES[color] ?? NAV_STYLES.slate

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      className={({ isActive }) =>
        `relative flex items-center gap-2.5 mx-2 px-2.5 py-2 my-0.5 rounded-lg text-sm
         transition-all duration-200 group
         ${isActive
            ? `${s.activeBg} shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]`
            : 'text-slate-700 hover:bg-slate-50 hover:translate-x-0.5'}`
      }
    >
      {({ isActive }) => (
        <>
          {/* Animated left active-border indicator. framer-motion's
              layoutId makes it slide between items, the only motion
              flourish in the otherwise calm sidebar. */}
          {isActive && (
            <motion.span
              layoutId="public-nav-active"
              className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full ${s.bar}`}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}

          {/* Colored icon chip — always tinted, brighter when active. */}
          <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0
                            ${s.chipBg} transition-transform duration-200 group-hover:scale-[1.04]`}>
            <Icon className={`w-4 h-4 ${s.chipIcon}`} strokeWidth={2.25} />
          </span>

          <div className="min-w-0 flex-1">
            <div className={`truncate leading-tight font-medium
                              ${isActive ? s.activeText : 'text-slate-800'}`}>
              {label}
            </div>
            <div className="text-[10px] text-slate-400 truncate leading-tight mt-px">
              {labelHi}
            </div>
          </div>

          <ChevronRight
            className={`w-3 h-3 transition
                        ${isActive
                          ? `${s.activeText} opacity-70`
                          : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}
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
        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1">
            <Outlet />
          </div>
          <PublicFooter />
        </main>
      </div>
    </div>
  )
}
