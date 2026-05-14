/**
 * FieldDiff — single renderer for a list of [key, oldValue, newValue]
 * tuples. Two display modes:
 *
 *   · mode="diff"   (default): each row shows `old line-through → new bold`.
 *                              Used in the audit-log timeline.
 *   · mode="create":           single-column "Proposed value" since
 *                              there is no prior state to diff against.
 *                              Used by the approval bell when the
 *                              ChangeRequest is a create operation.
 *
 * Field labels are looked up via the shared fieldLabels lib so we get
 * "Patta Number" instead of `patta_number` everywhere automatically.
 *
 * Used by:
 *   · ApprovalsBell  — pending-change diff in the bell dropdown
 *   · EditHistory    — historical change rows on detail pages
 *
 * Props:
 *   rows        Array<[key, oldValue, newValue]>
 *   mode?       'diff' | 'create'        — default: 'diff'
 *   title?      string                   — header band copy; default
 *                                          picks one from mode
 *   keyColumnW? number                   — px width of the field-label
 *                                          column; default 120
 */

import { ChevronRight } from 'lucide-react'
import { fieldLabel } from '@/lib/fieldLabels'

/** Compact display of any value type. Truncates strings > 200 chars. */
export function fmt(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v))      return v.length === 0 ? '—' : `[${v.length} items]`
  if (typeof v === 'object') return JSON.stringify(v)
  if (v === true)            return 'Yes'
  if (v === false)           return 'No'
  const s = String(v)
  return s.length > 200 ? s.slice(0, 200) + '…' : s
}

export function FieldDiff({ rows, mode = 'diff', title, keyColumnW = 120 }) {
  if (!rows || rows.length === 0) return null
  const isCreate = mode === 'create'
  const heading  = title ?? (isCreate ? 'Proposed values' : 'Changes')

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200
                      text-[10px] font-semibold uppercase tracking-widest text-slate-500
                      flex items-center justify-between">
        <span>{heading}</span>
        <span className="text-slate-400 normal-case font-normal text-[11px]">
          {rows.length} {rows.length === 1 ? 'field' : 'fields'}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map(([key, oldV, newV]) => (
          <div
            key={key}
            className="px-3 py-1.5 text-[11px] grid gap-2 items-baseline"
            style={{ gridTemplateColumns: `${keyColumnW}px 1fr` }}
          >
            <div className="text-slate-500 font-medium truncate" title={key}>
              {fieldLabel(key)}
            </div>
            <div className="min-w-0">
              {isCreate ? (
                <span className="text-slate-800 break-words">{fmt(newV)}</span>
              ) : (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-slate-400 line-through break-words max-w-[40%] truncate">
                    {fmt(oldV)}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
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

/**
 * Helper: walk two value bags and return a [key, oldValue, newValue]
 * list of fields that actually changed. Skips an internal denylist
 * (system columns, FK ids that surface elsewhere) plus anything
 * starting with an underscore.
 */
const _IGNORED = new Set([
  'id', 'created_at', 'updated_at', 'pk',
])

export function diffEntries(oldVals, newVals) {
  const all = new Set([
    ...Object.keys(oldVals || {}),
    ...Object.keys(newVals || {}),
  ])
  const out = []
  for (const k of all) {
    if (_IGNORED.has(k) || k.startsWith('_')) continue
    const a = (oldVals ?? {})[k]
    const b = (newVals ?? {})[k]
    try {
      if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue
    } catch {
      /* fall through and include */
    }
    out.push([k, a, b])
  }
  return out
}
