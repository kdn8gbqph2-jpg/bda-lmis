import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, RefreshCw, ArrowLeft } from 'lucide-react'
import { auth } from '@/api/endpoints'
import { useAuthStore } from '@/stores/useAuthStore'
import { Backdrop } from '@/components/ui/Backdrop'

export default function LoginPage() {
  const navigate  = useNavigate()
  const setAuth   = useAuthStore((s) => s.setAuth)
  const [form,    setForm]    = useState({ email: '', password: '', captcha: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [error,   setError]   = useState('')
  const [captcha, setCaptcha] = useState({ token: null, question: null })

  const fetchCaptcha = useCallback(async () => {
    try {
      const c = await auth.captcha()
      setCaptcha({ token: c.token, question: c.question })
      setForm((f) => ({ ...f, captcha: '' }))
    } catch {
      setCaptcha({ token: null, question: null })
    }
  }, [])

  useEffect(() => { fetchCaptcha() }, [fetchCaptcha])

  const login = useMutation({
    mutationFn: () => auth.login({
      email:          form.email,
      password:       form.password,
      captcha_token:  captcha.token,
      captcha_answer: form.captcha,
    }),
    onSuccess: (data) => {
      setAuth(data.user, data.access, data.refresh)
      navigate('/dashboard', { replace: true })
    },
    onError: (err) => {
      const d = err.response?.data
      const msg = d?.captcha?.[0]
                ?? d?.detail
                ?? d?.non_field_errors?.[0]
                ?? 'Invalid credentials. Please try again.'
      setError(msg)
      // CAPTCHA is single-use — always refresh after a failed attempt
      fetchCaptcha()
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    login.mutate()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Shared portal backdrop — same gradient + GIS-style grid texture
          used on the public dashboard and the staff shell, so the login
          page feels like part of the same product. */}
      <Backdrop />

      <div className="relative z-10 w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/bda-logo.png"
            alt="BDA"
            className="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-md"
          />
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">BDA LMIS</h1>
          <p className="text-blue-700 text-sm font-medium mt-1">Bharatpur Development Authority</p>
          <p className="text-slate-500 text-xs mt-0.5">भूमि प्रबंधन सूचना प्रणाली</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Blue header band — title on the left, back-link on the right.
              Tucks neatly into the same band so there's no extra chrome
              floating around the centered card. */}
          <div className="bg-blue-700 px-8 py-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-white font-semibold text-lg">Officer Login</h2>
              <p className="text-blue-200 text-xs mt-0.5">Enter your credentials to access the system</p>
            </div>
            <Link
              to="/public"
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 mt-0.5 rounded-md
                         bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white
                         text-xs font-medium transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Public Dashboard
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">

            {/* User ID */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                User ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Enter your user ID"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                             bg-slate-50 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                             bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Captcha */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Verify you are human
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg select-none">
                  <span className="font-mono font-bold text-slate-800 tabular-nums tracking-wider">
                    {captcha.question ?? '…'}
                  </span>
                  <span className="text-slate-400">= ?</span>
                </div>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Answer"
                  value={form.captcha}
                  onChange={(e) => setForm((f) => ({ ...f, captcha: e.target.value }))}
                  className="flex-1 min-w-0 px-3 py-2.5 border border-slate-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                             bg-slate-50"
                />
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  title="New challenge"
                  className="p-2.5 rounded-lg border border-slate-300 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold
                         py-2.5 rounded-lg transition text-sm shadow-sm flex items-center justify-center gap-2"
            >
              {login.isPending && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              Sign In to LMIS
            </button>

          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          © {new Date().getFullYear()} Bharatpur Development Authority, Rajasthan
        </p>
      </div>
    </div>
  )
}
