/**
 * PendingBanner — inline review surface for a queued ChangeRequest on a
 * Patta / Colony / Plot detail page.
 *
 * Two modes, picked automatically from the signed-in user's role:
 *
 *   · Staff / viewer  → a compact yellow banner that names the
 *                       submitter and lists which fields are pending,
 *                       so the staff member sees their own edit
 *                       in-flight without poking the bell.
 *
 *   · Admin / Super   → the same banner expanded inline with a full
 *                       field-by-field diff (old → new) and inline
 *                       Approve / Reject buttons. Saves the resolver
 *                       a click through the bell-dropdown when they
 *                       land on the record directly.
 *
 * The component is generic: it accepts any `record` (the live entity
 * detail) and uses the shared FieldDiff renderer + fieldLabels lib,
 * so Colony and Plot detail pages can drop it in with the same call.
 *
 * Props:
 *   cr      — ChangeRequest list/detail (with payload, requested_by_name)
 *   record  — live record state for diffing
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Check, X, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'

import { approvals as approvalsApi } from '@/api/endpoints'
import { useAuthStore } from '@/stores/useAuthStore'
import { fieldLabel } from '@/lib/fieldLabels'
import { FieldDiff } from '@/components/history/FieldDiff'

const MAX_FIELDS_SHOWN_COMPACT = 6

export function PendingBanner({ cr, record, onResolved }) {
  const { user } = useAuthStore()
  const role     = user?.role
  const canResolve = role === 'admin' || role === 'superintendent'
  const qc       = useQueryClient()
  // Resolvers see the diff expanded by default so they can review at a
  // glance; staff get the compact summary and can expand if curious.
  const [expanded, setExpanded] = useState(canResolve)

  // ── Resolution mutations ─────────────────────────────────────────────────
  // After both approve and reject we invalidate the shared query keys
  // and fire optional `onResolved` so callers (edit modals) can close —
  // approve made the form's record snapshot stale, reject removed the
  // pending state; in both cases the modal has nothing useful left.
  const approve = useMutation({
    mutationFn: () => approvalsApi.approve(cr.id),
    onSuccess:  () => { invalidateAll(qc); onResolved?.() },
    onError:    (err) => alert(err?.response?.data?.detail || 'Could not approve change.'),
  })
  const reject = useMutation({
    mutationFn: () => approvalsApi.reject(cr.id),
    onSuccess:  () => { invalidateAll(qc); onResolved?.() },
  })
  const busy = approve.isPending || reject.isPending

  if (!cr || !record) return null

  // Build the list of (key, oldValue, newValue) tuples. Filters out
  // payload keys whose value already matches the live record so the
  // diff only shows what's actually changing.
  const payload = cr.payload || {}
  const rows = []
  for (const k of Object.keys(payload)) {
    if (k.startsWith('_')) continue
    const cur = record?.[k]
    const nxt = payload[k]
    try {
      if (JSON.stringify(cur ?? null) === JSON.stringify(nxt ?? null)) continue
    } catch { /* fall through and include */ }
    rows.push([k, cur, nxt])
  }
  const changedLabels = rows.map(([k]) => fieldLabel(k))

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-900">
            Edit pending approval
          </div>
          <div className="text-xs text-amber-800/90 mt-0.5">
            Submitted by{' '}
            <span className="font-medium">{cr.requested_by_name || 'Staff user'}</span>
            {' · awaiting review by Admin or Superintendent.'}
          </div>
          {!expanded && changedLabels.length > 0 && (
            <div className="text-[11px] text-amber-700 mt-1">
              <span className="font-semibold uppercase tracking-wider">Pending changes: </span>
              {changedLabels.slice(0, MAX_FIELDS_SHOWN_COMPACT).join(', ')}
              {changedLabels.length > MAX_FIELDS_SHOWN_COMPACT &&
                ` +${changedLabels.length - MAX_FIELDS_SHOWN_COMPACT} more`}
            </div>
          )}
        </div>

        {/* Expand / collapse — relevant for both roles, default state
            differs (resolvers open, others closed). */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium
                     text-amber-800 hover:text-amber-900 transition"
        >
          {expanded ? 'Hide details' : 'View details'}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Diff + action buttons appear when expanded.
          Approve/Reject controls render only for resolvers. */}
      {expanded && rows.length > 0 && (
        <div className="space-y-3">
          <FieldDiff rows={rows} mode={cr.operation === 'create' ? 'create' : 'diff'} />

          {canResolve && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => approve.mutate()}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold
                           rounded-md bg-emerald-600 hover:bg-emerald-700 text-white
                           disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {approve.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Check  className="w-3.5 h-3.5" />}
                Approve change
              </button>
              <button
                type="button"
                onClick={() => reject.mutate()}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold
                           rounded-md bg-white hover:bg-red-50 text-red-700
                           border border-red-200 hover:border-red-300
                           disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
              <span className="text-[11px] text-amber-700 ml-1">
                Decision is recorded against your name in the edit history.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function invalidateAll(qc) {
  qc.invalidateQueries({ queryKey: ['approvals'] })
  qc.invalidateQueries({ queryKey: ['pattas']    })
  qc.invalidateQueries({ queryKey: ['patta']     })   // singular detail key
  qc.invalidateQueries({ queryKey: ['colonies']  })
  qc.invalidateQueries({ queryKey: ['plots']     })
  qc.invalidateQueries({ queryKey: ['audit']     })
  qc.invalidateQueries({ queryKey: ['dashboard'] })
}
