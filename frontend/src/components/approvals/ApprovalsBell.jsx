/**
 * ApprovalsBell — the topbar bell icon + dropdown for pending change
 * requests.
 *
 *   · Admin / Superintendent view: lists every pending request,
 *     inline Approve / Reject buttons per row. Badge shows total
 *     pending count.
 *   · Staff view: lists their own pending submissions so they can
 *     see what's still in the queue. No approve/reject controls;
 *     badge counts only their own outstanding items.
 *   · Viewer / no role: bell is hidden.
 *
 * Polls /count/ every 30s in the background so the badge stays
 * roughly fresh without spamming the network.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useQuery, useMutation, useQueryClient,
} from '@tanstack/react-query'
import { Bell, Check, X, Inbox, Building2, FileText, Grid3x3, Loader2 } from 'lucide-react'

import { approvals as approvalsApi } from '@/api/endpoints'
import { useAuthStore } from '@/stores/useAuthStore'

const TARGET_META = {
  patta:  { label: 'Patta',  icon: FileText  },
  colony: { label: 'Colony', icon: Building2 },
  plot:   { label: 'Plot',   icon: Grid3x3   },
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000)     return 'just now'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function ApprovalsBell() {
  const { user } = useAuthStore()
  const role     = user?.role
  const visible  = !!role && role !== 'viewer'
  const canResolve = role === 'admin' || role === 'superintendent'

  const [open, setOpen]   = useState(false)
  const containerRef      = useRef(null)
  const qc                = useQueryClient()

  // Badge count — short staleTime + interval so the bell stays fresh.
  const countQ = useQuery({
    queryKey: ['approvals', 'count'],
    queryFn:  approvalsApi.count,
    refetchInterval: 30_000,
    enabled:  visible,
  })

  // Full pending list — only fetched when the dropdown is open.
  const listQ = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn:  () => approvalsApi.list({ status: 'pending', page_size: 25 }),
    enabled:  visible && open,
    refetchOnWindowFocus: true,
  })

  // Mutations — approve / reject. Both invalidate the count + list
  // so the bell decrements as the user works through the queue.
  const approve = useMutation({
    mutationFn: (id) => approvalsApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      // Also invalidate downstream lists so the new/updated record shows up.
      qc.invalidateQueries({ queryKey: ['pattas']   })
      qc.invalidateQueries({ queryKey: ['colonies'] })
      qc.invalidateQueries({ queryKey: ['plots']    })
      qc.invalidateQueries({ queryKey: ['dashboard']})
    },
    onError: (err) => alert(err?.response?.data?.detail || 'Could not approve change.'),
  })
  const reject = useMutation({
    mutationFn: (id) => approvalsApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  })

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!visible) return null

  const count = countQ.data?.pending ?? 0
  const rows  = listQ.data?.results ?? []

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100
                   hover:text-slate-700 transition"
        aria-label="Pending approvals"
      >
        <Bell className="w-5 h-5" strokeWidth={2.25} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px]
                           px-1 rounded-full bg-red-500 text-white
                           text-[10px] font-bold leading-[18px] text-center
                           border-2 border-white shadow-sm">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] sm:w-[420px] z-50
                     bg-white rounded-xl border border-slate-200
                     shadow-[0_8px_28px_-8px_rgba(15,23,42,0.18)]
                     overflow-hidden animate-[fadeIn_120ms_ease-out]"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {canResolve ? 'Pending Approvals' : 'My Pending Submissions'}
              </div>
              <div className="text-[11px] text-slate-500">
                {count === 0
                  ? 'Nothing waiting'
                  : `${count} ${count === 1 ? 'item' : 'items'} awaiting review`}
              </div>
            </div>
            <Inbox className="w-4 h-4 text-slate-300" />
          </div>

          {/* List body */}
          <div className="max-h-[420px] overflow-y-auto">
            {listQ.isLoading && (
              <div className="px-4 py-8 text-center text-xs text-slate-400">Loading…</div>
            )}
            {!listQ.isLoading && rows.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-slate-400">
                You&apos;re all caught up.
              </div>
            )}
            {rows.map((r) => (
              <Row
                key={r.id}
                row={r}
                canResolve={canResolve}
                onApprove={() => approve.mutate(r.id)}
                onReject={()  => reject.mutate(r.id)}
                busy={approve.isPending && approve.variables === r.id
                      || reject.isPending && reject.variables === r.id}
              />
            ))}
          </div>

          {/* Footer (resolvers only) */}
          {canResolve && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
              <Link
                to="/admin/audit-logs"
                onClick={() => setOpen(false)}
                className="text-[11px] font-medium text-blue-700 hover:text-blue-900"
              >
                View full audit log →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Row ─────────────────────────────────────────────────────────────────────

function Row({ row, canResolve, onApprove, onReject, busy }) {
  const meta = TARGET_META[row.target_type] || { label: row.target_type, icon: FileText }
  const Icon = meta.icon
  const opVerb = row.operation === 'create' ? 'created' : 'updated'
  return (
    <div className="px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 rounded-md bg-blue-50 text-blue-700
                         inline-flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-800 truncate">
              {meta.label}
            </span>
            <span className="text-[11px] text-slate-400">
              {row.target_label
                ? <>· <span className="font-medium text-slate-600">{row.target_label}</span></>
                : null}
            </span>
            <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">
              {timeAgo(row.requested_at)}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            <span className="font-medium text-slate-600">
              {row.requested_by_name || 'Unknown'}
            </span>{' '}
            {opVerb} this record.
          </div>

          {canResolve && (
            <div className="flex items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={onApprove}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2.5 py-1
                           text-[11px] font-semibold rounded-md
                           bg-emerald-600 hover:bg-emerald-700 text-white
                           disabled:opacity-60 disabled:cursor-not-allowed
                           transition"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Approve
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2.5 py-1
                           text-[11px] font-semibold rounded-md
                           bg-white hover:bg-red-50 text-red-700 border border-red-200
                           hover:border-red-300
                           disabled:opacity-60 disabled:cursor-not-allowed
                           transition"
              >
                <X className="w-3 h-3" />
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
