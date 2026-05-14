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

import { useQuery } from '@tanstack/react-query'
import {
  Clock, Plus, Pencil, Trash2, BadgeCheck, User, ChevronRight,
} from 'lucide-react'

import { auditLogs as auditApi } from '@/api/endpoints'

// Field-name lookup table — keeps the UI from leaking raw column
// names like "lease_amount" when prettier labels are available.
const FIELD_LABELS = {
  // Patta
  patta_number:           'Patta Number',
  allottee_name:          'Allottee Name',
  allottee_address:       'Allottee Address',
  allottee_father_husband:'Allottee Father/Husband',
  issue_date:             'Issue Date',
  amendment_date:         'Amendment Date',
  challan_number:         'Challan Number',
  challan_date:           'Challan Date',
  lease_amount:           'Lease Amount',
  lease_duration:         'Lease Duration',
  regulation_file_present:'Regulation File Present',
  status:                 'Status',
  remarks:                'Remarks',
  rejection_reason:       'Rejection Reason',
  dms_file_number:        'DMS File Number',
  document_id:            'DMS Document',
  colony_id:              'Colony',
  superseded_by_id:       'Superseded By',
  updated_by_id:          'Updated By',
  // Colony
  name:                   'Name',
  colony_type:            'Type',
  zone:                   'Zone',
  revenue_village:        'Revenue Village',
  chak_number:            'Chak Number',
  dlc_file_number:        'DLC File Number',
  notified_area_bigha:    'Notified Area (Bigha)',
  conversion_date:        'Conversion Date',
  layout_approval_date:   'Layout Approval Date',
  total_plots_per_layout: 'Total Plots (Layout)',
  // Plot
  plot_number:            'Plot Number',
  type:                   'Type',
  area_sqy:               'Area (Sq.Yd)',
  primary_khasra_id:      'Primary Khasra',
}

const ACTION_META = {
  create: { Icon: Plus,   label: 'created', tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  update: { Icon: Pencil, label: 'updated', tint: 'bg-blue-50    text-blue-700    border-blue-200'    },
  delete: { Icon: Trash2, label: 'deleted', tint: 'bg-red-50     text-red-700     border-red-200'    },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v))      return v.length === 0 ? '—' : `[${v.length} items]`
  if (typeof v === 'object') return JSON.stringify(v)
  if (v === true)            return 'Yes'
  if (v === false)           return 'No'
  // Truncate very long values so a single overgrown remark doesn't
  // blow out the row layout.
  const s = String(v)
  return s.length > 200 ? s.slice(0, 200) + '…' : s
}

// Compute the list of (key, oldV, newV) tuples that actually changed
// between old_values and new_values. Hides system / FK noise.
const _IGNORED = new Set([
  'id', 'created_at', 'updated_at', 'pk',
])

function diff(oldVals, newVals) {
  const all = new Set([
    ...Object.keys(oldVals || {}),
    ...Object.keys(newVals || {}),
  ])
  const out = []
  for (const k of all) {
    if (_IGNORED.has(k)) continue
    const a = (oldVals ?? {})[k]
    const b = (newVals ?? {})[k]
    try {
      if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue
    } catch {
      /* fall through and show */
    }
    out.push([k, a, b])
  }
  return out
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
    : diff(entry.old_values, entry.new_values)

  const ts = new Date(entry.timestamp)
  const tsDisplay = ts.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const submitter = entry.submitted_by_name
  const resolver  = entry.user_name
  const wasApproval = !!(entry.change_request_id && submitter)

  return (
    <div className="px-5 py-4">
      {/* Top line — action chip + who + when */}
      <div className="flex items-baseline gap-2 flex-wrap mb-2">
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

        <span className="text-[11px] text-slate-400 ml-auto" title={tsDisplay}>
          {timeAgo(entry.timestamp)} · <span className="tabular-nums">{tsDisplay}</span>
        </span>
      </div>

      {/* Field-by-field diff */}
      {changes.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden mt-2">
          <div className="divide-y divide-slate-100">
            {changes.map(([key, a, b]) => (
              <div key={key} className="px-3 py-1.5 text-[11px] grid grid-cols-[120px,1fr] gap-2 items-baseline">
                <div className="text-slate-500 font-medium truncate" title={key}>
                  {FIELD_LABELS[key] || key}
                </div>
                <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-slate-400 line-through break-words max-w-[40%] truncate">
                    {fmt(a)}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-300" />
                  <span className="text-slate-900 font-medium break-words">
                    {fmt(b)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        entry.action === 'create' ? (
          <div className="text-[11px] text-slate-500 italic">Record created.</div>
        ) : entry.action === 'delete' ? (
          <div className="text-[11px] text-slate-500 italic">Record deleted.</div>
        ) : (
          <div className="text-[11px] text-slate-500 italic">
            No tracked field changes (system-only update).
          </div>
        )
      )}
    </div>
  )
}
