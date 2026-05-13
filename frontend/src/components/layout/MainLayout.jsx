import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Backdrop } from '@/components/ui/Backdrop'

export function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Desktop sidebar — always present at ≥ lg */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile drawer + backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              className="absolute left-0 top-0 h-full z-50 shadow-2xl"
            >
              <Sidebar onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Portal-wide backdrop — same as public surfaces. Each page's
            cards / tables sit on top in `relative` containers. */}
        <Backdrop />
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="relative flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
