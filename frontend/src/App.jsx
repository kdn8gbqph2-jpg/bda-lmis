import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { MainLayout } from '@/components/layout/MainLayout'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { lazy, Suspense } from 'react'

// Pages — lazy-loaded for faster initial paint
const LoginPage       = lazy(() => import('@/pages/LoginPage'))
const DashboardPage   = lazy(() => import('@/pages/DashboardPage'))
const ColoniesPage    = lazy(() => import('@/pages/ColoniesPage'))
const PlotsPage       = lazy(() => import('@/pages/PlotsPage'))
const MapPage         = lazy(() => import('@/pages/MapPage'))
const PattaLedgerPage = lazy(() => import('@/pages/PattaLedgerPage'))
const PattaDetailPage = lazy(() => import('@/pages/PattaDetailPage'))
const DocumentsPage   = lazy(() => import('@/pages/DocumentsPage'))
const ReportsPage     = lazy(() => import('@/pages/ReportsPage'))
const UsersPage       = lazy(() => import('@/pages/admin/UsersPage'))
const AuditLogsPage   = lazy(() => import('@/pages/admin/AuditLogsPage'))

// Public pages (no auth required)
const PublicDashboardPage    = lazy(() => import('@/pages/public/PublicDashboardPage'))
const PublicColoniesPage     = lazy(() => import('@/pages/public/PublicColoniesPage'))
const PublicColonyDetailPage = lazy(() => import('@/pages/public/PublicColonyDetailPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
    </div>
  )
}

// ── Auth guards (rendered as route elements) ───────────────────────────────────

function RequireAuth() {
  const access = useAuthStore((s) => s.access)
  if (!access) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireGuest() {
  const access = useAuthStore((s) => s.access)
  if (access) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function RequireAdmin() {
  const isAdmin = useAuthStore((s) => s.isAdmin)
  if (!isAdmin()) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// ── Suspense wrapper for lazy pages ───────────────────────────────────────────

function S({ children }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

// ── Router (data-router API — React Router v7 recommended) ────────────────────

const router = createBrowserRouter([
  // ── Guest-only ─────────────────────────────────────────────────────────────
  {
    element: <RequireGuest />,
    children: [
      { path: '/login', element: <S><LoginPage /></S> },
    ],
  },

  // ── Public colony dashboard (no auth required) ─────────────────────────────
  {
    path: '/public',
    element: <PublicLayout />,
    children: [
      { index: true,              element: <S><PublicDashboardPage /></S> },
      { path: 'colonies',         element: <S><PublicColoniesPage /></S> },
      { path: 'colonies/:id',     element: <S><PublicColonyDetailPage /></S> },
    ],
  },

  // ── Staff (auth required) ───────────────────────────────────────────────────
  {
    element: <RequireAuth />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { index: true,                   element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard',            element: <S><DashboardPage /></S> },
          { path: '/colonies',             element: <S><ColoniesPage /></S> },
          { path: '/plots',                element: <S><PlotsPage /></S> },
          { path: '/map',                  element: <S><MapPage /></S> },
          { path: '/patta-ledger',         element: <S><PattaLedgerPage /></S> },
          { path: '/patta-ledger/:id',     element: <S><PattaDetailPage /></S> },
          { path: '/documents',            element: <S><DocumentsPage /></S> },
          { path: '/reports',              element: <S><ReportsPage /></S> },
          // Admin-only
          {
            element: <RequireAdmin />,
            children: [
              { path: '/admin/users',      element: <S><UsersPage /></S> },
              { path: '/admin/audit-logs', element: <S><AuditLogsPage /></S> },
            ],
          },
        ],
      },
    ],
  },

  // ── Fallback ────────────────────────────────────────────────────────────────
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
