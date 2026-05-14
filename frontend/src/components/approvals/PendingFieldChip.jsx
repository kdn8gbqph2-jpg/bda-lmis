/**
 * PendingFieldChip — small inline badge that flags a single form field's
 * approval state. Three lifecycle states, only one rendered at a time:
 *
 *   1. PENDING (amber, Clock) + inline strikethrough diff
 *      · Staff has typed a new value locally (form differs from record), OR
 *      · A ChangeRequest is queued on the server for this field.
 *      The chip is followed by `~~old~~ → new` so the change is visible
 *      without opening a separate diff panel. The strikethrough stays
 *      until the change is approved (chip turns green) or rejected
 *      (chip disappears).
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

import { Clock, BadgeCheck, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { fmt } from '@/components/history/FieldDiff'
import { valuesEqual } from '@/components/approvals/recentApprovalMap'

// Mirror of backend approvals.mixins.BYPASS_FIELDS — fields that
// bypass the approval queue entirely (free-form notes + DMS linkage
// + filing flags). The chip stays silent on these so the UI doesn't
// claim "Pending approval" for a value that's about to save directly.
const BYPASS_FIELDS = new Set([
  'remarks', 'rejection_reason',
  'regulation_file_present', 'dms_file_number',
])

export function PendingFieldChip({ fieldKey, record, pendingCR, formValue, recentApproval }) {
  const role = useAuthStore((s) => s.user?.role)

  if (!fieldKey) return null
  if (BYPASS_FIELDS.has(fieldKey)) return null
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
      <span className="inline-flex items-center gap-1.5 flex-wrap align-middle">
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                     text-[10px] font-semibold uppercase tracking-wider
                     bg-amber-50 text-amber-800 border border-amber-200"
          title="Pending approval — will revert on reject, stay on approve"
        >
          <Clock className="w-2.5 h-2.5" strokeWidth={2.5} />
          Pending approval
        </span>
        <span className="inline-flex items-baseline gap-1 text-[11px] leading-none">
          <span className="line-through text-slate-400 max-w-[10rem] truncate">
            {fmt(current)}
          </span>
          <ChevronRight className="w-3 h-3 text-slate-300 self-center flex-shrink-0" />
          <span className="font-semibold text-slate-700 max-w-[10rem] truncate">
            {fmt(proposed)}
          </span>
        </span>
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
