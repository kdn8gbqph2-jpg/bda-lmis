/**
 * ColonyEditModal — admin-only colony edit form.
 *
 * Wraps a PUT /api/colonies/{id}/. Backend audit signals automatically
 * record old/new values + the editing user on every save, so there is
 * nothing extra to log from the client.
 */

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle } from 'lucide-react'

import { colonies as coloniesApi } from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'

// ── Choice constants ─────────────────────────────────────────────────────────
// Must match backend models.py choices verbatim.

const COLONY_TYPE_CHOICES = [
  { value: 'bda_scheme',       label: 'BDA Scheme'              },
  { value: 'private_approved', label: 'Private Approved Colony' },
  { value: 'suo_moto',         label: 'SUO-Moto Colony Case'    },
  { value: 'pending_layout',   label: 'Pending Colony Layout'   },
  { value: 'rejected_layout',  label: 'Rejected Colony Layout'  },
]

const ZONE_CHOICES = [
  { value: 'East', label: 'East' },
  { value: 'West', label: 'West' },
]

const STATUS_CHOICES = [
  { value: 'active',   label: 'Active'   },
  { value: 'new',      label: 'New'      },
  { value: 'archived', label: 'Archived' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Drop empty/undefined fields and coerce numerics so PUT body is clean. */
function cleanPayload(form) {
  const out = {}
  for (const [k, v] of Object.entries(form)) {
    if (v === '' || v === null || v === undefined) {
      out[k] = null
      continue
    }
    out[k] = v
  }
  // Ints
  for (const k of ['chak_number', 'total_residential_plots', 'total_commercial_plots']) {
    if (out[k] !== null && out[k] !== undefined) out[k] = Number(out[k])
  }
  return out
}

const FIELD_ORDER = [
  'name', 'colony_type', 'zone', 'status',
  'chak_number', 'dlc_file_number', 'notified_area_bigha',
  'conversion_date', 'layout_application_date', 'layout_approval_date',
  'total_residential_plots', 'total_commercial_plots',
  'rejection_reason', 'remarks',
]

function fromColony(colony) {
  const out = {}
  for (const f of FIELD_ORDER) out[f] = colony?.[f] ?? ''
  return out
}

// ── Component ────────────────────────────────────────────────────────────────

export function ColonyEditModal({ colony, open, onClose, onSaved }) {
  const queryClient = useQueryClient()
  const [form, setForm]   = useState(() => fromColony(colony))
  const [errors, setErrors] = useState({})

  // Re-seed when the modal is re-opened for a different colony
  useEffect(() => {
    if (open) {
      setForm(fromColony(colony))
      setErrors({})
    }
  }, [open, colony])

  const mutation = useMutation({
    mutationFn: () => coloniesApi.update(colony.id, cleanPayload(form)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['colonies'] })
      queryClient.invalidateQueries({ queryKey: ['colony', colony.id] })
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

  const isRejected = form.colony_type === 'rejected_layout'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Colony — ${colony?.name ?? ''}`}
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

        {/* Audit notice */}
        <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          All edits are recorded in the audit log along with your user ID and timestamp.
        </div>

        {/* Identity */}
        <Section title="Identity">
          <Input
            label="Colony Name"
            value={form.name}
            onChange={set('name')}
            error={errors.name?.[0]}
            required
          />
          <Select label="Colony Type" value={form.colony_type} onChange={set('colony_type')}>
            {COLONY_TYPE_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Select label="Zone" value={form.zone} onChange={set('zone')}>
            {ZONE_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Select label="Status" value={form.status} onChange={set('status')}>
            {STATUS_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </Section>

        {/* Survey */}
        <Section title="Survey">
          <Input
            label="Chak Number"
            type="number"
            value={form.chak_number ?? ''}
            onChange={set('chak_number')}
            error={errors.chak_number?.[0]}
          />
          <Input
            label="DLC File Number"
            value={form.dlc_file_number ?? ''}
            onChange={set('dlc_file_number')}
            error={errors.dlc_file_number?.[0]}
          />
          <Input
            label="Notified Area (Bigha)"
            type="number"
            step="0.01"
            value={form.notified_area_bigha ?? ''}
            onChange={set('notified_area_bigha')}
            error={errors.notified_area_bigha?.[0]}
          />
        </Section>

        {/* Timeline */}
        <Section title="Timeline">
          <Input
            label="Conversion Date"
            type="date"
            value={form.conversion_date ?? ''}
            onChange={set('conversion_date')}
          />
          <Input
            label="Layout Application Date"
            type="date"
            value={form.layout_application_date ?? ''}
            onChange={set('layout_application_date')}
          />
          <Input
            label="Layout Approval Date"
            type="date"
            value={form.layout_approval_date ?? ''}
            onChange={set('layout_approval_date')}
          />
        </Section>

        {/* Plot counts */}
        <Section title="Plot Counts">
          <Input
            label="Residential Plots"
            type="number"
            value={form.total_residential_plots ?? ''}
            onChange={set('total_residential_plots')}
          />
          <Input
            label="Commercial Plots"
            type="number"
            value={form.total_commercial_plots ?? ''}
            onChange={set('total_commercial_plots')}
          />
        </Section>

        {/* Notes */}
        <div className="space-y-4">
          {isRejected && (
            <Textarea
              label="Rejection Reason"
              value={form.rejection_reason ?? ''}
              onChange={set('rejection_reason')}
              error={errors.rejection_reason?.[0]}
              required
              hint="Required for rejected layouts. Visible on the public dashboard."
            />
          )}
          <Textarea
            label="Remarks"
            value={form.remarks ?? ''}
            onChange={set('remarks')}
          />
        </div>

        {/* Top-level error */}
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

function Textarea({ label, value, onChange, error, required, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <textarea
        value={value}
        onChange={onChange}
        rows={3}
        className={`w-full rounded-lg border bg-white text-sm text-slate-900 px-3 py-2 shadow-xs
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    ${error ? 'border-red-400' : 'border-slate-300'}`}
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
