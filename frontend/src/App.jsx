import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { MainLayout } from '@/components/layout/MainLayout'
import { lazy, Suspense } from 'react'

// Pages — lazy-loaded for faster initial paint
const LoginPage       = lazy(() => import('@/pages/LoginPage'))
const DashboardPage   = lazy(() => import('@/pages/DashboardPage'))
const ColoniesPage    = lazy(() => import('@/pages/ColoniesPage'))
const PlotsPage       = lazy(() => import('@/pages/PlotsPage'))
const PattaLedgerPage = lazy(() => import('@/pages/PattaLedgerPage'))
const PattaDetailPage = lazy(() => import('@/pages/PattaDetailPage'))
const DocumentsPage   = lazy(() => import('@/pages/DocumentsPage'))
const UsersPage       = lazy(() => import('@/pages/admin/UsersPage'))
const AuditLogsPage   = lazy(() => import('@/pages/admin/AuditLogsPage'))

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<RequireGuest />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route element={<MainLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"        element={<DashboardPage />} />
                <Route path="/colonies"         element={<ColoniesPage />} />
                <Route path="/plots"            element={<PlotsPage />} />
                <Route path="/patta-ledger"     element={<PattaLedgerPage />} />
                <Route path="/patta-ledger/:id" element={<PattaDetailPage />} />
                <Route path="/documents"        element={<DocumentsPage />} />

                <Route element={<RequireAdmin />}>
                  <Route path="/admin/users"       element={<UsersPage />} />
                  <Route path="/admin/audit-logs"  element={<AuditLogsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
