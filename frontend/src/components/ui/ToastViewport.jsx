/**
 * ToastViewport — single mount point for every toast in the app.
 * Lives at the top of the layout tree (MainLayout + PublicLayout +
 * LoginPage) so toasts surface regardless of where the user is.
 *
 * Stack grows top-right; older items push down. Auto-dismissal is
 * handled by the store; we just render whatever's in it.
 */

import { CheckCircle2, Info, AlertCircle, AlertTriangle, X } from 'lucide-react'
import { useToastStore } from '@/stores/useToastStore'

const KIND_STYLES = {
  success: {
    icon:  CheckCircle2,
    bg:    'bg-white border-emerald-200',
    bar:   'bg-emerald-500',
    text:  'text-emerald-700',
  },
  info: {
    icon:  Info,
    bg:    'bg-white border-blue-200',
    bar:   'bg-blue-500',
    text:  'text-blue-700',
  },
  warning: {
    icon:  AlertTriangle,
    bg:    'bg-white border-amber-200',
    bar:   'bg-amber-500',
    text:  'text-amber-700',
  },
  error: {
    icon:  AlertCircle,
    bg:    'bg-white border-red-200',
    bar:   'bg-red-500',
    text:  'text-red-700',
  },
}

export function ToastViewport() {
  const toasts  = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const s = KIND_STYLES[t.kind] ?? KIND_STYLES.info
        const Icon = s.icon
        return (
          <div
            key={t.id}
            className={`pointer-events-auto relative overflow-hidden flex items-start gap-2
                        min-w-[280px] max-w-[400px] rounded-xl border ${s.bg}
                        shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)] px-3 py-2.5
                        animate-[fadeIn_120ms_ease-out]`}
            role="status"
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${s.bar}`} />
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${s.text}`} strokeWidth={2.25} />
            <span className="text-sm text-slate-700 leading-snug pr-4">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="absolute right-1.5 top-1.5 p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
