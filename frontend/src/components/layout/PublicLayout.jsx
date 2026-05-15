/**
 * PublicLayout — modern dashboard shell for the public portal.
 *
 * Architecture:
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  TopNavbar (sticky, search + actions)                      │
 *   ├────────────────────────────────────────────────────────────┤
 *   │  <Outlet /> — page content (scrolls)                       │
 *   ├────────────────────────────────────────────────────────────┤
 *   │  PublicFooter                                              │
 *   └────────────────────────────────────────────────────────────┘
 *
 * The left sidebar that used to list colony categories was removed —
 * the dashboard's category cards already cover that navigation and
 * the colonies page has its own scheme/zone/village/status filters,
 * so the sidebar was duplicating information.
 */

import { Outlet } from 'react-router-dom'

import { TopNavbar } from '@/components/public/TopNavbar'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { ToastViewport } from '@/components/ui/ToastViewport'

export function PublicLayout() {
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <TopNavbar />
      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1">
          <Outlet />
        </div>
        <PublicFooter />
      </main>
      <ToastViewport />
    </div>
  )
}
