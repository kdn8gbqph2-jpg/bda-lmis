/**
 * EditHistory — read-only timeline of every change to a Patta / Colony
 * / Plot record. Renders entries from the AuditLog API, which captures
 * before/after values for every save plus (when applicable) the
 * original Staff submitter and the Admin/Super resolver.
 *
 * Each entry shows:
 *   · Timestamp + action verb (created / updated / deleted)
 *   · "Edited by <name>" — and when applicable, a green
 *     "Approved by <name>" pill
 *   · Field-by-field diff: only fields that actually changed appear,
 *     each line shows old → new in slate-vs-blue colors.
 *
 * Audit log entries are immutable by design — the API exposes them
 * read-only and there's no delete endpoint, so this panel is a
 * trustworthy record of every modification to the underlying record.
 *
 * Usage:
 *   <EditHistory entityType="patta" entityId={123} />
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock, Plus, Pencil, Trash2, BadgeCheck, ChevronDown,
} from 'lucide-react'

import { auditLogs as auditApi } from '@/api/endpoints'
import { FieldDiff, diffEntries } from '@/components/history/FieldDiff'
import { fieldLabel } from '@/lib/fieldLabels'

const ACTION_META = {
  create: { Icon: Plus,   label: 'created', tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  update: { Icon: Pencil, label: 'updated', tint: 'bg-blue-50    text-blue-700    border-blue-200'    },
  delete: { Icon: Trash2, label: 'deleted', tint: 'bg-red-50     text-red-700     border-red-200'    },
}

function timeAgo(ts) {
  if (!ts) return ''
  const d   = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  if (diffMs < 60_000)     return 'just now'
  if (diffMs < 3_600_000)  return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  if (diffMs < 7 * 86_400_000) return `${Math.floor(diffMs / 86_400_000)}d ago`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Main component ─────────────────────────────────────────────────────────

export function EditHistory({ entityType, entityId }) {
  const q = useQuery({
    queryKey: ['audit', entityType, entityId],
    queryFn:  () => auditApi.list({
      entity_type: entityType,
      entity_id:   entityId,
      page_size:   50,
    }),
    enabled:  !!entityType && !!entityId,
    staleTime: 30_000,
  })

  const entries = q.data?.results ?? []

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">Edit History</h3>
        <span className="text-[11px] text-slate-400 ml-1">
          · read-only audit trail
        </span>
        {q.data?.count != null && (
          <span className="ml-auto text-[11px] text-slate-400">
            {q.data.count} {q.data.count === 1 ? 'entry' : 'entries'}
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {q.isLoading && (
          <div className="px-5 py-8 text-center text-xs text-slate-400">Loading…</div>
        )}
        {!q.isLoading && entries.length === 0 && (
          <div className="px-5 py-8 text-center text-xs text-slate-400">
            No history recorded yet.
          </div>
        )}
        {entries.map((e) => <Entry key={e.id} entry={e} />)}
      </div>
    </div>
  )
}

// ── Single audit entry ─────────────────────────────────────────────────────

function Entry({ entry }) {
  const meta = ACTION_META[entry.action] || ACTION_META.update
  const Icon = meta.Icon
  const changes = entry.action === 'delete'
    ? []                                  // delete shows no diff (only old_values)
    : diffEntries(entry.old_values, entry.new_values)
  const [expanded, setExpanded] = useState(false)

  const ts = new Date(entry.timestamp)
  const tsDisplay = ts.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const submitter = entry.submitted_by_name
  const resolver  = entry.user_name
  const wasApproval = !!(entry.change_request_id && submitter)

  // Build a compact one-line summary of changed fields by label. Used
  // as the default subtle preview so a long history doesn't scream
  // diff blocks until the reader opts in.
  const summary = (() => {
    if (entry.action === 'create')  return 'Record created.'
    if (entry.action === 'delete')  return 'Record deleted.'
    if (changes.length === 0)       return 'No tracked field changes.'
    const labels = changes.slice(0, 3).map(([k]) => fieldLabel(k))
    const more   = changes.length - labels.length
    return `Updated ${labels.join(', ')}${more > 0 ? ` +${more} more` : ''}.`
  })()
  const canExpand = changes.length > 0

  return (
    <div className="px-5 py-3">
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        className={`w-full text-left ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {/* Top line — action chip + who + when */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                            text-[10px] font-semibold uppercase tracking-wider
                            border ${meta.tint}`}>
            <Icon className="w-3 h-3" strokeWidth={2.5} />
            {meta.label}
          </span>

          {wasApproval ? (
            <span className="text-xs text-slate-600">
              by <span className="font-medium text-slate-800">{submitter}</span>
            </span>
          ) : (
            <span className="text-xs text-slate-600">
              by <span className="font-medium text-slate-800">{resolver || 'System'}</span>
            </span>
          )}

          {wasApproval && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                             text-[10px] font-semibold
                             bg-emerald-50 text-emerald-700 border border-emerald-200">
              <BadgeCheck className="w-3 h-3" strokeWidth={2.5} />
              Approved by {resolver}
            </span>
          )}

          <span className="text-[11px] text-slate-400 ml-auto flex items-center gap-1"
                title={tsDisplay}>
            {timeAgo(entry.timestamp)}
            {canExpand && (
              <ChevronDown className={`w-3 h-3 transition-transform
                                       ${expanded ? 'rotate-180' : ''}`} />
            )}
          </span>
        </div>

        {/* Subtle one-line summary — replaces the always-expanded diff. */}
        <div className="text-[11px] text-slate-500 mt-1 leading-snug">
          {summary}
        </div>
      </button>

      {/* Full diff appears only when the entry is expanded. */}
      {expanded && changes.length > 0 && (
        <div className="mt-2">
          <FieldDiff rows={changes} />
        </div>
      )}
    </div>
  )
}
