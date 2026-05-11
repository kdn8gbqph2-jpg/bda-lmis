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

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle } from 'lucide-react'

import { pattas as pattasApi } from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'

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

  const mutation = useMutation({
    mutationFn: () => pattasApi.update(patta.id, cleanPayload(form)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pattas'] })
      queryClient.invalidateQueries({ queryKey: ['patta', patta.id] })
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
            required
          />
          <Select label="Status" value={form.status} onChange={set('status')}>
            {PATTA_STATUS_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </Section>

        <Section title="Allottee">
          <Input
            label="Allottee Name"
            value={form.allottee_name}
            onChange={set('allottee_name')}
            error={errors.allottee_name?.[0]}
            required
          />
          <Textarea
            label="Allottee Address"
            value={form.allottee_address ?? ''}
            onChange={set('allottee_address')}
          />
        </Section>

        <Section title="Dates">
          <Input
            label="Issue Date"
            type="date"
            value={form.issue_date ?? ''}
            onChange={set('issue_date')}
            required
            error={errors.issue_date?.[0]}
          />
          <Input
            label="Amendment Date"
            type="date"
            value={form.amendment_date ?? ''}
            onChange={set('amendment_date')}
          />
        </Section>

        <Section title="Financial">
          <Input
            label="Challan Number"
            value={form.challan_number ?? ''}
            onChange={set('challan_number')}
          />
          <Input
            label="Challan Date"
            type="date"
            value={form.challan_date ?? ''}
            onChange={set('challan_date')}
          />
          <Input
            label="Lease Amount (₹)"
            type="number"
            step="0.01"
            value={form.lease_amount ?? ''}
            onChange={set('lease_amount')}
          />
          <Input
            label="Lease Duration"
            placeholder="e.g. 99 वर्ष"
            value={form.lease_duration ?? ''}
            onChange={set('lease_duration')}
          />
        </Section>

        <Section title="Other">
          <Select
            label="Regulation File Present"
            value={form.regulation_file_present === true ? 'true'
                  : form.regulation_file_present === false ? 'false'
                  : ''}
            onChange={set('regulation_file_present')}
          >
            {REG_FILE_CHOICES.map((c) => (
              <option key={String(c.value)} value={String(c.value)}>{c.label}</option>
            ))}
          </Select>
        </Section>

        <Textarea
          label="Remarks"
          value={form.remarks ?? ''}
          onChange={set('remarks')}
        />

        {errors._detail && (
          <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {errors._detail}
          </div>
        )}
      </form>
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
