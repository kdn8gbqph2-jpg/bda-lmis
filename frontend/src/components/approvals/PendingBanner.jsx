/**
 * PendingBanner — yellow inline banner shown on a Patta / Colony /
 * Plot detail page when a ChangeRequest is queued for that record.
 *
 *   · Reads the pending CR's payload, diffs it against the live record,
 *     and lists the fields that the queued payload intends to change.
 *   · Surfaces the submitter's name so the staff member knows their
 *     own edit is in flight, and other viewers can see who's waiting
 *     on whom.
 *
 * Props:
 *   cr      — the ChangeRequest list item (id, requested_by_name, payload, ...)
 *   record  — the live record object (Patta / Colony / Plot detail)
 */

import { AlertTriangle } from 'lucide-react'
import { fieldLabel } from '@/lib/fieldLabels'

const MAX_FIELDS_SHOWN = 6

export function PendingBanner({ cr, record }) {
  if (!cr || !record) return null

  // Walk the queued payload and collect every key whose value actually
  // differs from the live record state. JSON.stringify covers arrays
  // and objects; primitives compare cleanly.
  const payload = cr.payload || {}
  const changed = []
  for (const k of Object.keys(payload)) {
    if (k.startsWith('_')) continue
    const cur = record?.[k]
    try {
      if (JSON.stringify(cur ?? null) !== JSON.stringify(payload[k] ?? null)) {
        changed.push(fieldLabel(k))
      }
    } catch {
      changed.push(fieldLabel(k))
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3
                    flex items-start gap-3">
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
        {changed.length > 0 && (
          <div className="text-[11px] text-amber-700 mt-1">
            <span className="font-semibold uppercase tracking-wider">Pending changes: </span>
            {changed.slice(0, MAX_FIELDS_SHOWN).join(', ')}
            {changed.length > MAX_FIELDS_SHOWN && ` +${changed.length - MAX_FIELDS_SHOWN} more`}
          </div>
        )}
      </div>
    </div>
  )
}
