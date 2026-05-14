/**
 * Build a `{ fieldKey: { approverName, timestamp } }` map from a paged
 * AuditLog response. Used by edit modals to feed each PendingFieldChip
 * its "was this field recently approved?" signal.
 *
 * Entries arrive newest-first; for each field, the first entry that
 * touches it is the most-recent change. Approval-sourced changes are
 * kept; a later direct edit (no change_request_id) overrides and the
 * field drops out of the map — we never claim "approved" for a value
 * that's since been overwritten by a non-approval save.
 *
 * Exported separately from PendingFieldChip.jsx so Vite Fast Refresh
 * stays happy (component files should only export components).
 */

const APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Loose equality for diff/chip code. Normalizes the three "empty"
 * representations — '', null, undefined — to a single sentinel so the
 * chip doesn't fire on fields the user didn't actually change.
 *
 * The asymmetry comes from cleanPayload normalizing form '' to null
 * for nullable columns, while DRF serializes Django CharField(blank=True)
 * as '' from records that have never been set. JSON.stringify('') !==
 * JSON.stringify(null), so a strict compare would flag every empty
 * nullable field as "pending approval" on every save.
 */
export function valuesEqual(a, b) {
  const norm = (v) => (v === '' || v === undefined ? null : v)
  try { return JSON.stringify(norm(a)) === JSON.stringify(norm(b)) }
  catch { return false }
}

export function buildRecentApprovalMap(entries) {
  if (!entries?.length) return {}
  const out = {}
  const cutoff = Date.now() - APPROVAL_WINDOW_MS
  for (const e of entries) {
    if (new Date(e.timestamp).getTime() < cutoff) break
    const oldV = e.old_values || {}
    const newV = e.new_values || {}
    const keys = new Set([...Object.keys(oldV), ...Object.keys(newV)])
    for (const k of keys) {
      if (k in out) continue
      if (valuesEqual(oldV[k], newV[k])) continue
      // Approval-sourced rows have submitted_by_name populated (the
      // audit signal sets it only when a ChangeRequest was in flight).
      // We used to check change_request_id but that FK gets nulled
      // after the CR is hard-deleted; submitted_by is the durable mark.
      out[k] = e.submitted_by_name
        ? { approverName: e.user_name, timestamp: e.timestamp }
        : null
    }
  }
  for (const k of Object.keys(out)) if (!out[k]) delete out[k]
  return out
}
