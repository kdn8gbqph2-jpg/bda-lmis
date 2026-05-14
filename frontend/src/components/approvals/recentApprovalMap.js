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

function valuesEqual(a, b) {
  try { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null) }
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
      out[k] = e.change_request_id
        ? { approverName: e.user_name, timestamp: e.timestamp }
        : null
    }
  }
  for (const k of Object.keys(out)) if (!out[k]) delete out[k]
  return out
}
