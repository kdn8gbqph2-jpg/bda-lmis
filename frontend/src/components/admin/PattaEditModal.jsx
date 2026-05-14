/**
 * PattaEditModal — admin-only patta edit form.
 *
 * Wraps a PUT /api/pattas/{id}/. Backend audit signals automatically
 * record old/new values + the editing user on every save.
 *
 * Note: this form does NOT change colony assignment, link documents,
 * supersede pattas, or modify plot mappings — those have their own
 * dedicated workflows. It edits patta metadata in place.
 */

import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle } from 'lucide-react'

import {
  pattas as pattasApi,
  approvals as approvalsApi,
  auditLogs as auditApi,
} from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { HindiInput, HindiTextarea } from '@/components/ui/HindiInput'
import { PendingFieldChip } from '@/components/approvals/PendingFieldChip'
import { PendingBanner } from '@/components/approvals/PendingBanner'
import { buildRecentApprovalMap } from '@/components/approvals/recentApprovalMap'
import { EditHistory } from '@/components/history/EditHistory'

// ── Choice constants — must match backend models.py verbatim ─────────────────

const PATTA_STATUS_CHOICES = [
  { value: 'issued',     label: 'Issued'     },
  { value: 'missing',    label: 'Missing'    },
  { value: 'cancelled',  label: 'Cancelled'  },
  { value: 'amended',    label: 'Amended'    },
  { value: 'superseded', label: 'Superseded' },
]

const REG_FILE_CHOICES = [
  { value: '',     label: 'Unknown' },
  { value: true,   label: 'Yes (हाँ)' },
  { value: false,  label: 'No (नही)'  },
]

// PUT-bound fields only. `colony` is intentionally excluded — moving a
// patta between colonies has cascade effects we don't expose in the UI.
const FIELD_ORDER = [
  'patta_number',
  'allottee_name', 'allottee_address',
  'issue_date', 'amendment_date',
  'challan_number', 'challan_date',
  'lease_amount', 'lease_duration',
  'regulation_file_present',
  'status',
  'remarks',
  'dms_file_number',
]

function fromPatta(patta) {
  const out = {}
  for (const f of FIELD_ORDER) out[f] = patta?.[f] ?? ''
  // Backend `colony` FK is required by PattaWriteSerializer — include it as-is.
  out.colony = patta?.colony ?? null
  return out
}

function cleanPayload(form) {
  const out = { ...form }
  for (const k of Object.keys(out)) {
    if (out[k] === '') out[k] = null
  }
  if (out.lease_amount !== null && out.lease_amount !== undefined) {
    out.lease_amount = Number(out.lease_amount)
  }
  // regulation_file_present: must be true | false | null
  if (out.regulation_file_present === 'true')  out.regulation_file_present = true
  if (out.regulation_file_present === 'false') out.regulation_file_present = false
  // DMS file number — send as cleaned UPPERCASE string (or null to clear).
  // Note: backend treats null as "don't touch" but empty string ("") as
  // "clear link". The cleanPayload above already mapped '' → null which
  // would lose the clear semantics, so send back an empty string if the
  // form's value was an empty string after trim.
  if (typeof form.dms_file_number === 'string') {
    const trimmed = form.dms_file_number.trim().toUpperCase()
    out.dms_file_number = trimmed === '' ? '' : trimmed
  }
  return out
}

// ── Component ────────────────────────────────────────────────────────────────

export function PattaEditModal({ patta, open, onClose, onSaved }) {
  const queryClient = useQueryClient()
  const [form,   setForm]   = useState(() => fromPatta(patta))
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(fromPatta(patta))
      setErrors({})
    }
  }, [open, patta])

  // Pending ChangeRequest for this patta, if any. We fetch it when the
  // modal opens so per-field PendingFieldChip badges can flag which
  // values are awaiting review. Cheap query — a single page_size=1 call.
  const pendingQ = useQuery({
    queryKey: ['approvals', 'pending', 'patta', patta?.id],
    queryFn:  () => approvalsApi.list({
      target_type: 'patta',
      target_id:   patta?.id,
      status:      'pending',
      page_size:   1,
    }),
    enabled: open && !!patta?.id,
    staleTime: 30_000,
  })
  const pendingCR = pendingQ.data?.results?.[0]

  // Recent audit log — feeds the transient "Approved" green chip on
  // fields touched by an approved CR within the past 24h.
  const recentAuditQ = useQuery({
    queryKey: ['audit', 'patta', patta?.id, 'recent'],
    queryFn:  () => auditApi.list({ entity_type: 'patta', entity_id: patta?.id, page_size: 20 }),
    enabled:  open && !!patta?.id,
    staleTime: 30_000,
  })
  const recentApprovals = useMemo(
    () => buildRecentApprovalMap(recentAuditQ.data?.results ?? []),
    [recentAuditQ.data],
  )

  const chip = (fieldKey) => (
    <PendingFieldChip
      fieldKey={fieldKey}
      record={patta}
      pendingCR={pendingCR}
      formValue={form[fieldKey]}
      recentApproval={recentApprovals[fieldKey]}
    />
  )

  const mutation = useMutation({
    mutationFn: () => pattasApi.update(patta.id, cleanPayload(form)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pattas'] })
      queryClient.invalidateQueries({ queryKey: ['patta', patta.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      // Refresh bell + Edit History timeline immediately. Staff saves
      // produce a new pending CR; admin saves produce a new AuditLog row.
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['audit']     })
      onSaved?.(data)
      onClose()
    },
    onError: (err) => {
      setErrors(err.response?.data ?? { _detail: 'Failed to save changes.' })
    },
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrors({})
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Patta — #${patta?.patta_number ?? ''}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>
            Save Changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Top-of-modal banner — surfaces a pending CR on revisit so staff
            (and resolvers) see what's awaiting approval without scanning
            every field's label chip. */}
        {pendingCR && <PendingBanner cr={pendingCR} record={patta} onResolved={onClose} />}

        <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          All edits are recorded in the audit log along with your user ID and timestamp.
        </div>

        <Section title="Identity">
          <Input
            label="Patta Number"
            value={form.patta_number}
            onChange={set('patta_number')}
            error={errors.patta_number?.[0]}
            labelExtra={chip('patta_number')}
            required
          />
          <Select
            label="Status"
            value={form.status}
            onChange={set('status')}
            labelExtra={chip('status')}
          >
            {PATTA_STATUS_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </Section>

        {/* ── Linked colony info (read-only — moving a patta between colonies
              has cascade effects we don't surface in this form) ──────────── */}
        <LinkedSection patta={patta} />

        <Section title="Allottee">
          <HindiInput
            label="Allottee Name"
            value={form.allottee_name}
            onChange={set('allottee_name')}
            error={errors.allottee_name?.[0]}
            labelExtra={chip('allottee_name')}
            required
          />
          <HindiTextarea
            label="Allottee Address"
            value={form.allottee_address ?? ''}
            onChange={set('allottee_address')}
            error={errors.allottee_address?.[0]}
            labelExtra={chip('allottee_address')}
          />
        </Section>

        <Section title="Dates">
          <Input
            label="Issue Date"
            type="date"
            value={form.issue_date ?? ''}
            onChange={set('issue_date')}
            error={errors.issue_date?.[0]}
            labelExtra={chip('issue_date')}
            required
          />
          <Input
            label="Amendment Date"
            type="date"
            value={form.amendment_date ?? ''}
            onChange={set('amendment_date')}
            labelExtra={chip('amendment_date')}
          />
        </Section>

        <Section title="Financial">
          <Input
            label="Challan Number"
            value={form.challan_number ?? ''}
            onChange={set('challan_number')}
            labelExtra={chip('challan_number')}
          />
          <Input
            label="Challan Date"
            type="date"
            value={form.challan_date ?? ''}
            onChange={set('challan_date')}
            labelExtra={chip('challan_date')}
          />
          <Input
            label="Lease Amount (₹)"
            type="number"
            step="0.01"
            value={form.lease_amount ?? ''}
            onChange={set('lease_amount')}
            labelExtra={chip('lease_amount')}
          />
          <Input
            label="Lease Duration"
            placeholder="e.g. 99 वर्ष"
            value={form.lease_duration ?? ''}
            onChange={set('lease_duration')}
            labelExtra={chip('lease_duration')}
          />
        </Section>

        <Section title="Other">
          <Select
            label="Regulation File Present"
            value={form.regulation_file_present === true ? 'true'
                  : form.regulation_file_present === false ? 'false'
                  : ''}
            onChange={set('regulation_file_present')}
            labelExtra={chip('regulation_file_present')}
          >
            {REG_FILE_CHOICES.map((c) => (
              <option key={String(c.value)} value={String(c.value)}>{c.label}</option>
            ))}
          </Select>
          <Input
            label="DMS File Number"
            placeholder="e.g. BHR104758 — leave blank to unlink"
            value={form.dms_file_number ?? ''}
            onChange={(e) => set('dms_file_number')({
              target: { value: e.target.value.toUpperCase() }
            })}
            error={errors.dms_file_number?.[0]}
            labelExtra={chip('dms_file_number')}
          />
        </Section>

        <HindiTextarea
          label="Remarks"
          value={form.remarks ?? ''}
          onChange={set('remarks')}
          error={errors.remarks?.[0]}
        />

        {errors._detail && (
          <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {errors._detail}
          </div>
        )}
      </form>

      {patta?.id && (
        <div className="mt-6">
          <EditHistory entityType="patta" entityId={patta.id} />
        </div>
      )}
    </Modal>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

// ── Linked colony info (read-only) ──────────────────────────────────────────

const PILL_PALETTE = [
  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200'  },
  { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'    },
  { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200'     },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  },
  { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200'    },
]

function pillColor(token) {
  let h = 0
  for (const c of String(token)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PILL_PALETTE[h % PILL_PALETTE.length]
}

function LinkedSection({ patta }) {
  const summary = patta?.colony_summary
  const plots   = patta?.plot_numbers ?? []
  const khasras = summary?.khasras ?? []
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Linked <span className="text-slate-400 normal-case font-normal">· read-only</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReadOnlyField label="Colony / Scheme Name" value={summary?.name} />
        <ReadOnlyField label="Zone"                 value={summary?.zone} />
        <ReadOnlyField label="Revenue Village"      value={summary?.revenue_village} />
        <ReadOnlyField label="Plot No(s)"           hint={`${plots.length} plot${plots.length === 1 ? '' : 's'}`}>
          {plots.length === 0
            ? <span className="text-xs text-slate-400">No plots linked.</span>
            : (
              <div className="flex flex-wrap gap-1.5">
                {plots.map((p) => {
                  const c = pillColor(p)
                  return (
                    <span key={p}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
                      {p}
                    </span>
                  )
                })}
              </div>
            )}
        </ReadOnlyField>
      </div>
      <div className="mt-4">
        <ReadOnlyField label="Khasra No(s)" hint={`${khasras.length} khasra${khasras.length === 1 ? '' : 's'} in colony`}>
          {khasras.length === 0
            ? <span className="text-xs text-slate-400">No khasras recorded.</span>
            : (
              <div className="flex flex-wrap gap-1.5">
                {khasras.map((k) => {
                  const c = pillColor(k)
                  return (
                    <span key={k}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
                      {k}
                    </span>
                  )
                })}
              </div>
            )}
        </ReadOnlyField>
      </div>
      <div className="mt-4">
        <DmsLocationField number={patta?.dms_file_number} path={patta?.dms_file_path} />
      </div>
    </div>
  )
}

function DmsLocationField({ number, path }) {
  // Mirrors the rest of the linked section: read-only, two-line layout.
  // Copy button is only useful when there's a path to copy, so we hide
  // it on rows where the nightly sync hasn't found a match yet.
  const copy = () => {
    if (!path) return
    navigator.clipboard?.writeText(path).catch(() => {})
  }
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-slate-700">DMS File</label>
        {path && (
          <button
            type="button"
            onClick={copy}
            className="text-[11px] text-blue-700 hover:text-blue-900"
            title="Copy path to clipboard"
          >
            Copy path
          </button>
        )}
      </div>
      <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm min-h-[2.4rem]">
        {number ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono font-semibold text-slate-800">{number}</span>
            {path
              ? <span className="text-xs font-mono text-slate-500 break-all">{path}</span>
              : <span className="text-xs text-slate-400">Location not yet synced from DMS server.</span>}
          </div>
        ) : (
          <span className="text-slate-400">No DMS file linked.</span>
        )}
      </div>
    </div>
  )
}

function ReadOnlyField({ label, value, children, hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 min-h-[2.4rem]">
        {children ?? (value ? value : <span className="text-slate-400">—</span>)}
      </div>
    </div>
  )
}

function Textarea({ label, value, onChange, error }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        rows={3}
        className={`w-full rounded-lg border bg-white text-sm text-slate-900 px-3 py-2 shadow-xs
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    ${error ? 'border-red-400' : 'border-slate-300'}`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
