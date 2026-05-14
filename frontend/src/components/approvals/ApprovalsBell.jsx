/**
 * ApprovalsBell — topbar bell icon + dropdown for pending change
 * requests.
 *
 *   · Admin / Superintendent: lists every pending request. Each row is
 *     expandable on click; the expansion shows what's actually being
 *     changed (field-by-field diff against the current record state)
 *     plus a "View record" link that opens the target in the relevant
 *     list page. Inline Approve / Reject buttons stay visible regardless
 *     of expansion state.
 *   · Staff: lists their own pending submissions so they can see
 *     what's still in the queue (no resolve controls).
 *   · Viewer / no role: bell is hidden.
 *
 * Polls /count/ every 30s in the background so the badge stays roughly
 * fresh; the list fetches only when the panel is open.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useQuery, useMutation, useQueryClient,
} from '@tanstack/react-query'
import {
  Bell, Check, X, Inbox, Building2, FileText, Grid3x3,
  Loader2, ChevronDown, ExternalLink, Plus, Pencil,
} from 'lucide-react'

import { approvals as approvalsApi } from '@/api/endpoints'
import { useAuthStore } from '@/stores/useAuthStore'

const TARGET_META = {
  patta:  { label: 'Patta',  icon: FileText,  listUrl: () => '/patta-ledger', detailUrl: (id) => `/patta-ledger/${id}` },
  colony: { label: 'Colony', icon: Building2, listUrl: () => '/colonies',     detailUrl: () => '/colonies' },
  plot:   { label: 'Plot',   icon: Grid3x3,   listUrl: () => '/plots',        detailUrl: () => '/plots' },
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000)     return 'just now'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function ApprovalsBell() {
  const { user } = useAuthStore()
  const role     = user?.role
  const visible  = !!role && role !== 'viewer'
  const canResolve = role === 'admin' || role === 'superintendent'

  const [open, setOpen]               = useState(false)
  const [expandedId, setExpandedId]   = useState(null)
  const containerRef                  = useRef(null)
  const qc                            = useQueryClient()

  const countQ = useQuery({
    queryKey: ['approvals', 'count'],
    queryFn:  approvalsApi.count,
    refetchInterval: 30_000,
    enabled:  visible,
  })

  const listQ = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn:  () => approvalsApi.list({ status: 'pending', page_size: 25 }),
    enabled:  visible && open,
    refetchOnWindowFocus: true,
  })

  const approve = useMutation({
    mutationFn: (id) => approvalsApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['pattas']    })
      qc.invalidateQueries({ queryKey: ['colonies']  })
      qc.invalidateQueries({ queryKey: ['plots']     })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => alert(err?.response?.data?.detail || 'Could not approve change.'),
  })
  const reject = useMutation({
    mutationFn: (id) => approvalsApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  })

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setExpandedId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!visible) return null

  const count = countQ.data?.pending ?? 0
  const rows  = listQ.data?.results ?? []

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100
                   hover:text-slate-700 transition"
        aria-label="Pending approvals"
      >
        <Bell className="w-5 h-5" strokeWidth={2.25} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px]
                           px-1 rounded-full bg-red-500 text-white
                           text-[10px] font-bold leading-[18px] text-center
                           border-2 border-white shadow-sm">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[380px] sm:w-[440px] z-50
                     bg-white rounded-xl border border-slate-200
                     shadow-[0_8px_28px_-8px_rgba(15,23,42,0.18)]
                     overflow-hidden animate-[fadeIn_120ms_ease-out]"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {canResolve ? 'Pending Approvals' : 'My Pending Submissions'}
              </div>
              <div className="text-[11px] text-slate-500">
                {count === 0
                  ? 'Nothing waiting'
                  : `${count} ${count === 1 ? 'item' : 'items'} awaiting review`}
              </div>
            </div>
            <Inbox className="w-4 h-4 text-slate-300" />
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {listQ.isLoading && (
              <div className="px-4 py-8 text-center text-xs text-slate-400">Loading…</div>
            )}
            {!listQ.isLoading && rows.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-slate-400">
                You&apos;re all caught up.
              </div>
            )}
            {rows.map((r) => (
              <Row
                key={r.id}
                row={r}
                canResolve={canResolve}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                onApprove={() => approve.mutate(r.id)}
                onReject={()  => reject.mutate(r.id)}
                onClose={()   => { setOpen(false); setExpandedId(null) }}
                busy={
                  (approve.isPending && approve.variables === r.id) ||
                  (reject.isPending  && reject.variables  === r.id)
                }
              />
            ))}
          </div>

          {canResolve && rows.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
              <Link
                to="/admin/audit-logs"
                onClick={() => setOpen(false)}
                className="text-[11px] font-medium text-blue-700 hover:text-blue-900"
              >
                View full audit log →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Row ─────────────────────────────────────────────────────────────────────

function Row({ row, canResolve, expanded, onToggle, onApprove, onReject, onClose, busy }) {
  const meta = TARGET_META[row.target_type] || {
    label: row.target_type, icon: FileText, listUrl: () => '/dashboard', detailUrl: () => '/dashboard',
  }
  const Icon = meta.icon
  const OpIcon = row.operation === 'create' ? Plus : Pencil
  const opVerb = row.operation === 'create' ? 'created' : 'updated'

  // Lazy-fetch the full detail (with current snapshot + payload) only
  // when the row is expanded. Keeps the bell open quick when there
  // are many pending items.
  const detailQ = useQuery({
    queryKey: ['approvals', 'detail', row.id],
    queryFn:  () => approvalsApi.detail(row.id),
    enabled:  expanded,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className={`border-b border-slate-100 last:border-b-0 transition
                     ${expanded ? 'bg-blue-50/30' : 'hover:bg-slate-50/60'}`}>
      {/* Summary line — click anywhere to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        <span className="w-7 h-7 rounded-md bg-blue-50 text-blue-700
                         inline-flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-800 truncate inline-flex items-center gap-1">
              <OpIcon className="w-3 h-3 text-slate-400" />
              {meta.label}
            </span>
            {row.target_label && (
              <span className="text-[11px] text-slate-500">
                · <span className="font-medium text-slate-700">{row.target_label}</span>
              </span>
            )}
            <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">
              {timeAgo(row.requested_at)}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            <span className="font-medium text-slate-600">
              {row.requested_by_name || 'Unknown'}
            </span>{' '}
            {opVerb} this record.
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5
                      transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-3">
          <DiffBlock
            loading={detailQ.isLoading}
            detail={detailQ.data}
            targetType={row.target_type}
          />

          {/* Approve / Reject + "View record" */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {canResolve && (
              <>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-2.5 py-1
                             text-[11px] font-semibold rounded-md
                             bg-emerald-600 hover:bg-emerald-700 text-white
                             disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Approve
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-2.5 py-1
                             text-[11px] font-semibold rounded-md
                             bg-white hover:bg-red-50 text-red-700 border border-red-200
                             hover:border-red-300 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  <X className="w-3 h-3" />
                  Reject
                </button>
              </>
            )}
            {row.target_id && (
              <Link
                to={meta.detailUrl(row.target_id)}
                onClick={onClose}
                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1
                           text-[11px] font-semibold rounded-md text-blue-700
                           hover:bg-blue-50 transition"
              >
                View record
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Inline Approve / Reject when not expanded (only for resolvers
          so the queue stays scannable). */}
      {!expanded && canResolve && (
        <div className="flex items-center gap-1.5 px-4 pb-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onApprove() }}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2.5 py-1
                       text-[11px] font-semibold rounded-md
                       bg-emerald-600 hover:bg-emerald-700 text-white
                       disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Approve
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReject() }}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2.5 py-1
                       text-[11px] font-semibold rounded-md
                       bg-white hover:bg-red-50 text-red-700 border border-red-200
                       hover:border-red-300 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            <X className="w-3 h-3" />
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

// ── Diff block ──────────────────────────────────────────────────────────────

const FIELD_LABELS = {
  // Patta
  patta_number:           'Patta Number',
  allottee_name:          'Allottee Name',
  allottee_address:       'Allottee Address',
  issue_date:             'Issue Date',
  amendment_date:         'Amendment Date',
  challan_number:         'Challan Number',
  challan_date:           'Challan Date',
  lease_amount:           'Lease Amount',
  lease_duration:         'Lease Duration',
  regulation_file_present:'Regulation File Present',
  status:                 'Status',
  remarks:                'Remarks',
  dms_file_number:        'DMS File Number',
  colony:                 'Colony',
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
  rejection_reason:       'Rejection Reason',
  khasras_input:          'Khasras',
  // Plot
  plot_number:            'Plot Number',
  type:                   'Type',
  area_sqy:               'Area (Sq.Yd)',
  primary_khasra:         'Primary Khasra',
}

/** Pretty-print a single value for the diff cells. */
function fmt(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v))        return v.length === 0 ? '—' : `[${v.length} items]`
  if (typeof v === 'object')   return JSON.stringify(v)
  if (v === true)              return 'Yes'
  if (v === false)             return 'No'
  return String(v)
}

function DiffBlock({ loading, detail }) {
  if (loading) {
    return (
      <div className="text-[11px] text-slate-400 flex items-center gap-1 py-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading details…
      </div>
    )
  }
  if (!detail) return null

  const proposed = detail.payload  || {}
  const current  = detail.current  || {}
  const isCreate = detail.operation === 'create'

  // Walk the proposed payload and build a list of (field, old, new) rows.
  // For creates, "old" is always empty. For updates, we only include
  // fields where old != new (so unchanged data doesn't crowd the view).
  const rows = []
  for (const key of Object.keys(proposed)) {
    if (key.startsWith('_')) continue
    const newV = proposed[key]
    const oldV = current[key]
    if (!isCreate) {
      // Coarse "did this change" check. JSON.stringify catches arrays
      // and dicts; primitives compare cleanly.
      try {
        if (JSON.stringify(oldV ?? null) === JSON.stringify(newV ?? null)) continue
      } catch { /* if it doesn't stringify cleanly, include it */ }
    }
    rows.push([key, oldV, newV])
  }

  if (rows.length === 0) {
    return (
      <div className="text-[11px] text-slate-500 italic py-1">
        No visible changes detected in the submitted payload.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200
                      text-[10px] font-semibold uppercase tracking-widest text-slate-500
                      flex items-center justify-between">
        <span>{isCreate ? 'Proposed values' : 'Changes'}</span>
        <span className="text-slate-400 normal-case font-normal text-[11px]">
          {rows.length} {rows.length === 1 ? 'field' : 'fields'}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map(([key, oldV, newV]) => (
          <div key={key} className="px-3 py-1.5 text-[11px] grid grid-cols-[110px,1fr] gap-2 items-baseline">
            <div className="text-slate-500 font-medium truncate" title={key}>
              {FIELD_LABELS[key] || key}
            </div>
            <div className="min-w-0">
              {isCreate ? (
                <span className="text-slate-800 break-words">{fmt(newV)}</span>
              ) : (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-slate-400 line-through break-words max-w-[180px] truncate">
                    {fmt(oldV)}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span className="text-slate-900 font-medium break-words">
                    {fmt(newV)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
