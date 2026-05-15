/**
 * AuditLogsPage — admin/superintendent view of the full AuditLog feed.
 *
 * Each row is clickable to expand into a field-by-field diff (old → new)
 * plus the actor's name + mobile + IP, the original submitter for
 * approval-sourced rows, and the change-request id if any.
 *
 * Filterable by entity type and action. Pagination via the shared
 * Pagination control.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown, Plus, Pencil, Trash2, User as UserIcon, Phone, Globe,
} from 'lucide-react'

import { auditLogs as auditApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Table'
import { FieldDiff, diffEntries } from '@/components/history/FieldDiff'
import { fieldLabel } from '@/lib/fieldLabels'

const PAGE_SIZE = 30

const ACTIONS = [
  { value: '',        label: 'All Actions' },
  { value: 'create',  label: 'Create' },
  { value: 'update',  label: 'Update' },
  { value: 'delete',  label: 'Delete' },
]

const ENTITY_TYPES = [
  { value: '',         label: 'All Entities' },
  { value: 'colony',   label: 'Colony' },
  { value: 'plot',     label: 'Plot' },
  { value: 'patta',    label: 'Patta' },
  { value: 'document', label: 'Document' },
]

const ACTION_META = {
  create: { Icon: Plus,   label: 'Create', tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  update: { Icon: Pencil, label: 'Update', tint: 'bg-blue-50    text-blue-700    border-blue-200'    },
  delete: { Icon: Trash2, label: 'Delete', tint: 'bg-red-50     text-red-700     border-red-200'     },
}

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function entityLabel(r) {
  const snap = r.new_values ?? r.old_values ?? {}
  return snap.name
      ?? snap.patta_number
      ?? snap.plot_number
      ?? snap.original_filename
      ?? `#${r.entity_id}`
}

// ── Single row ──────────────────────────────────────────────────────────────

function Row({ entry, striped }) {
  const meta = ACTION_META[entry.action] || ACTION_META.update
  const Icon = meta.Icon
  const changes = entry.action === 'delete'
    ? []
    : diffEntries(entry.old_values, entry.new_values)
  const [expanded, setExpanded] = useState(false)

  const summary = (() => {
    if (entry.action === 'create')  return 'Record created.'
    if (entry.action === 'delete')  return 'Record deleted.'
    if (changes.length === 0)       return 'No tracked field changes.'
    const labels = changes.slice(0, 3).map(([k]) => fieldLabel(k))
    const more   = changes.length - labels.length
    return `Updated ${labels.join(', ')}${more > 0 ? ` +${more} more` : ''}.`
  })()
  const canExpand = changes.length > 0 || entry.action === 'delete' || entry.action === 'create'

  const actor       = entry.user_name || 'System'
  const actorMobile = entry.user_mobile
  const submitter   = entry.submitted_by_name
  const subMobile   = entry.submitted_by_mobile

  return (
    <div className={`border-b border-slate-100 last:border-b-0 transition
                     ${expanded ? 'bg-blue-50/30' : striped ? 'bg-slate-50/40' : 'bg-white'}`}>
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        className={`w-full text-left px-4 py-3 grid grid-cols-12 gap-3 items-center
                    ${canExpand ? 'cursor-pointer hover:bg-blue-50/50' : 'cursor-default'}`}
      >
        {/* Action chip */}
        <div className="col-span-1">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                            text-[10px] font-semibold uppercase tracking-wider
                            border ${meta.tint}`}>
            <Icon className="w-3 h-3" strokeWidth={2.5} />
            {meta.label}
          </span>
        </div>

        {/* Entity */}
        <div className="col-span-3 min-w-0">
          <div className="text-sm capitalize text-slate-800">{entry.entity_type}</div>
          <div className="text-xs text-slate-500 truncate" title={entityLabel(entry)}>
            {entityLabel(entry)}
          </div>
        </div>

        {/* User */}
        <div className="col-span-3 min-w-0">
          <div className="text-sm text-slate-800 truncate flex items-center gap-1">
            <UserIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
            {actor}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
            {actorMobile && (
              <span className="inline-flex items-center gap-0.5">
                <Phone className="w-3 h-3 text-slate-400" />
                <span className="tabular-nums">{actorMobile}</span>
              </span>
            )}
            {entry.user_email && !actorMobile && (
              <span className="truncate">{entry.user_email}</span>
            )}
          </div>
        </div>

        {/* IP */}
        <div className="col-span-2 text-xs text-slate-500 tabular-nums truncate">
          {entry.ip_address ? (
            <span className="inline-flex items-center gap-1">
              <Globe className="w-3 h-3 text-slate-400" />
              {entry.ip_address}
            </span>
          ) : '—'}
        </div>

        {/* Time */}
        <div className="col-span-2 text-xs text-slate-500 text-right">
          {fmtTime(entry.timestamp)}
        </div>

        {/* Chevron */}
        <div className="col-span-1 flex justify-end">
          {canExpand && (
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform
                                     ${expanded ? 'rotate-180' : ''}`} />
          )}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Summary line + submitter attribution */}
          <div className="text-xs text-slate-600 leading-snug">
            {summary}
            {submitter && (
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                              text-[10px] font-semibold
                              bg-emerald-50 text-emerald-700 border border-emerald-200">
                Submitted by {submitter}
                {subMobile && <span className="tabular-nums">· {subMobile}</span>}
              </div>
            )}
          </div>

          {/* Field-level diff (create / update) */}
          {changes.length > 0 && (
            <FieldDiff rows={changes} mode={entry.action === 'create' ? 'create' : 'diff'} />
          )}

          {/* Tombstone snapshot (delete) — show old values so the record
              isn't just a 'deleted' chip with no detail. */}
          {entry.action === 'delete' && entry.old_values && Object.keys(entry.old_values).length > 0 && (
            <FieldDiff
              rows={Object.entries(entry.old_values)
                .filter(([k]) => k !== 'id' && !k.startsWith('_'))
                .map(([k, v]) => [k, v, null])}
              mode="diff"
              title="Snapshot at delete"
            />
          )}

          {/* User-agent + change-request linkage for context */}
          <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500">
            {entry.user_agent && (
              <div className="truncate" title={entry.user_agent}>
                <span className="text-slate-400">UA:</span> {entry.user_agent}
              </div>
            )}
            {entry.change_request_id && (
              <div>
                <span className="text-slate-400">ChangeRequest:</span> #{entry.change_request_id}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [action,     setAction]     = useState('')
  const [entityType, setEntityType] = useState('')
  const [page,       setPage]       = useState(1)

  const logs = useQuery({
    queryKey: ['audit-logs', page, action, entityType],
    queryFn: () => auditApi.list({
      page, page_size: PAGE_SIZE,
      action, entity_type: entityType,
    }),
    placeholderData: (prev) => prev,
  })

  const reset = () => setPage(1)
  const rows = logs.data?.results ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Select value={entityType} onChange={(e) => { setEntityType(e.target.value); reset() }}>
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div className="w-36">
          <Select value={action} onChange={(e) => { setAction(e.target.value); reset() }}>
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </Select>
        </div>
        <span className="text-sm text-slate-500 ml-auto">
          {logs.data?.count ?? '…'} log entries
        </span>
      </div>

      <Card padding={false}>
        {/* Header row */}
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50
                        grid grid-cols-12 gap-3
                        text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
          <div className="col-span-1">Action</div>
          <div className="col-span-3">Entity</div>
          <div className="col-span-3">User</div>
          <div className="col-span-2">IP</div>
          <div className="col-span-2 text-right">Time</div>
          <div className="col-span-1" />
        </div>

        {logs.isPending && (
          <div className="px-4 py-12 text-center text-slate-400 text-sm">Loading…</div>
        )}
        {!logs.isPending && rows.length === 0 && (
          <div className="px-4 py-12 text-center text-slate-400 text-sm">
            No audit log entries.
          </div>
        )}
        {rows.map((e, i) => <Row key={e.id} entry={e} striped={i % 2 === 1} />)}
      </Card>

      <Pagination
        page={page}
        totalPages={Math.ceil((logs.data?.count || 0) / PAGE_SIZE)}
        count={logs.data?.count}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />
    </div>
  )
}
