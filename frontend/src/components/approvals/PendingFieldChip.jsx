/**
 * PendingFieldChip — small inline badge that flags a single form field's
 * approval state. Three lifecycle states, only one rendered at a time:
 *
 *   1. PENDING (amber, Clock)
 *      · Staff has typed a new value locally (form differs from record), OR
 *      · A ChangeRequest is queued on the server for this field.
 *      Both share one visual because in both cases an approval is in
 *      flight (or about to be).
 *
 *   2. APPROVED (green, BadgeCheck) — transient, 24h window
 *      · The field's most recent audit-log change came through an
 *        approved ChangeRequest. After 24h the chip disappears; the
 *        change stays in the Edit History timeline.
 *      · If a later non-approval edit (direct admin save) overrides
 *        the approved value, the green chip is suppressed.
 *
 *   3. Nothing — field is in a settled state.
 *
 * Drop next to any field's label inside an edit modal via the
 * `labelExtra` slot on Input / Select / HindiInput / HindiTextarea.
 */

import { Clock, BadgeCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'

function valuesEqual(a, b) {
  try { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null) }
  catch { return false }
}

function proposedLabel(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v))      return `[${v.length} items]`
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80)
  return String(v).slice(0, 80)
}

export function PendingFieldChip({ fieldKey, record, pendingCR, formValue, recentApproval }) {
  const role = useAuthStore((s) => s.user?.role)

  if (!fieldKey) return null
  const current = record?.[fieldKey]

  // ── Pending: server-side queued OR local staff edit ─────────────────
  const serverProposed = pendingCR?.payload?.[fieldKey]
  const hasServerPending =
    pendingCR &&
    pendingCR.payload && Object.prototype.hasOwnProperty.call(pendingCR.payload, fieldKey) &&
    !valuesEqual(serverProposed, current)
  // Local-diff chip is only meaningful for staff — admin/super writes
  // save directly and don't queue, so showing "Pending approval" while
  // they edit would be misleading.
  const hasLocalDiff =
    role === 'staff' && formValue !== undefined &&
    !valuesEqual(formValue, current)

  if (hasServerPending || hasLocalDiff) {
    const proposed = hasServerPending ? serverProposed : formValue
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                   text-[10px] font-semibold uppercase tracking-wider
                   bg-amber-50 text-amber-800 border border-amber-200 align-middle"
        title={`Pending approval · proposed value: ${proposedLabel(proposed)}`}
      >
        <Clock className="w-2.5 h-2.5" strokeWidth={2.5} />
        Pending approval
      </span>
    )
  }

  // ── Approved: recent audit log entry via approved CR ────────────────
  if (recentApproval) {
    const when = new Date(recentApproval.timestamp).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                   text-[10px] font-semibold uppercase tracking-wider
                   bg-emerald-50 text-emerald-800 border border-emerald-200 align-middle"
        title={`Approved by ${recentApproval.approverName} · ${when}`}
      >
        <BadgeCheck className="w-2.5 h-2.5" strokeWidth={2.5} />
        Approved
      </span>
    )
  }

  return null
}
