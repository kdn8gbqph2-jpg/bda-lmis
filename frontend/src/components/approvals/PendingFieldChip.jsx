/**
 * PendingFieldChip — small inline badge that flags a single form
 * field as having a pending change in the approval queue.
 *
 *   · If `pendingCR.payload[fieldKey]` differs from `record[fieldKey]`,
 *     renders a red "Pending approval" chip.
 *   · Otherwise renders nothing (lets the layout stay clean for fields
 *     with no in-flight change).
 *
 * Drop next to any field's label inside an edit modal:
 *
 *   <label>Status <PendingFieldChip fieldKey="status"
 *                                     record={patta}
 *                                     pendingCR={pendingCR} /></label>
 *
 * Used in conjunction with the PendingBanner (record-level summary).
 */

import { Clock } from 'lucide-react'

export function PendingFieldChip({ fieldKey, record, pendingCR }) {
  if (!pendingCR || !fieldKey) return null

  const payload  = pendingCR.payload || {}
  // If the queued payload doesn't even mention this key, nothing's
  // changing here — skip silently.
  if (!(fieldKey in payload)) return null

  const proposed = payload[fieldKey]
  const current  = record?.[fieldKey]
  try {
    if (JSON.stringify(proposed ?? null) === JSON.stringify(current ?? null)) {
      return null    // value is the same — staff submitted but didn't
                     // actually change this field
    }
  } catch { /* fall through and show the chip */ }

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                 text-[10px] font-semibold uppercase tracking-wider
                 bg-amber-50 text-amber-800 border border-amber-200
                 align-middle"
      title={`Pending approval · proposed value: ${proposedLabel(proposed)}`}
    >
      <Clock className="w-2.5 h-2.5" strokeWidth={2.5} />
      Pending approval
    </span>
  )
}

function proposedLabel(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v))      return `[${v.length} items]`
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80)
  return String(v).slice(0, 80)
}
