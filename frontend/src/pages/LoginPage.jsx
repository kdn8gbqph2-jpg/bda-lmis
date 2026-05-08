import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { auth } from '@/api/endpoints'
import { useAuthStore } from '@/stores/useAuthStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const navigate   = useNavigate()
  const setAuth    = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  const login = useMutation({
    mutationFn: () => auth.login({ email: form.email, password: form.password }),
    onSuccess: (data) => {
      setAuth(data.user, data.access, data.refresh)
      navigate('/dashboard', { replace: true })
    },
    onError: (err) => {
      const detail = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0]
      setError(detail || 'Invalid credentials. Please try again.')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    login.mutate()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 leading-tight">BDA LMIS</p>
            <p className="text-xs text-slate-500">Bharatpur Development Authority</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-xl font-semibold text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-6">Land Management Information System</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="officer@bda.gov.in"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-1"
              loading={login.isPending}
            >
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          BDA LMIS · Bharatpur · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
