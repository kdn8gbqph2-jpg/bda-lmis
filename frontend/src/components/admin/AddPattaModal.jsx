/**
 * AddPattaModal — staff/admin form to create a new patta record.
 *
 * Wraps POST /api/pattas/. Required by backend serializer: patta_number,
 * colony, allottee_name, issue_date. The rest are optional and can be
 * filled in via the edit modal later.
 */

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle } from 'lucide-react'

import { pattas as pattasApi, colonies as coloniesApi } from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'

const PATTA_STATUS_CHOICES = [
  { value: 'issued',     label: 'Issued'     },
  { value: 'missing',    label: 'Missing'    },
  { value: 'cancelled',  label: 'Cancelled'  },
  { value: 'amended',    label: 'Amended'    },
  { value: 'superseded', label: 'Superseded' },
]

const REG_FILE_CHOICES = [
  { value: '',     label: 'Unknown'  },
  { value: 'true', label: 'Yes (हाँ)' },
  { value: 'false',label: 'No (नही)'  },
]

const EMPTY = {
  patta_number: '',
  colony: '',
  allottee_name: '',
  allottee_address: '',
  issue_date: '',
  amendment_date: '',
  challan_number: '',
  challan_date: '',
  lease_amount: '',
  lease_duration: '',
  regulation_file_present: '',
  status: 'issued',
  remarks: '',
}

function cleanPayload(form) {
  const out = {}
  for (const [k, v] of Object.entries(form)) {
    if (v === '' || v === null || v === undefined) {
      // Required text fields keep '', others go to null
      if (k === 'remarks' || k === 'allottee_address') out[k] = ''
      else out[k] = null
    } else {
      out[k] = v
    }
  }
  // Numeric coercion
  if (out.colony !== null)       out.colony       = Number(out.colony)
  if (out.lease_amount !== null) out.lease_amount = Number(out.lease_amount)
  // Tri-state boolean
  if (out.regulation_file_present === 'true')  out.regulation_file_present = true
  if (out.regulation_file_present === 'false') out.regulation_file_present = false
  return out
}

export function AddPattaModal({ open, onClose, onCreated }) {
  const queryClient = useQueryClient()
  const [form,   setForm]   = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setErrors({})
    }
  }, [open])

  const coloniesQ = useQuery({
    queryKey: ['colonies-select'],
    queryFn:  () => coloniesApi.list({ page_size: 200 }),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })
  const colonyOptions = coloniesQ.data?.results ?? []

  const mutation = useMutation({
    mutationFn: () => pattasApi.create(cleanPayload(form)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pattas'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onCreated?.(data)
      onClose()
    },
    onError: (err) => {
      setErrors(err.response?.data ?? { _detail: 'Failed to create patta.' })
    },
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrors({})
    if (!form.patta_number || !form.colony || !form.allottee_name || !form.issue_date) {
      setErrors({ _detail: 'Patta number, colony, allottee name and issue date are required.' })
      return
    }
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Patta"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>Create Patta</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Creation is recorded in the audit log along with your user ID and timestamp.
        </div>

        <Section title="Identity">
          <Input
            label="Patta Number *"
            value={form.patta_number} onChange={set('patta_number')}
            error={errors.patta_number?.[0]}
            required
          />
          <Select label="Colony *" value={form.colony} onChange={set('colony')}>
            <option value="">— select colony —</option>
            {colonyOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select label="Status" value={form.status} onChange={set('status')}>
            {PATTA_STATUS_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </Section>

        <Section title="Allottee">
          <Input
            label="Allottee Name *"
            value={form.allottee_name} onChange={set('allottee_name')}
            error={errors.allottee_name?.[0]}
            required
          />
          <Textarea
            label="Allottee Address"
            value={form.allottee_address} onChange={set('allottee_address')}
          />
        </Section>

        <Section title="Dates">
          <Input
            label="Issue Date *" type="date"
            value={form.issue_date} onChange={set('issue_date')}
            error={errors.issue_date?.[0]}
            required
          />
          <Input
            label="Amendment Date" type="date"
            value={form.amendment_date} onChange={set('amendment_date')}
          />
        </Section>

        <Section title="Financial">
          <Input label="Challan Number"  value={form.challan_number}  onChange={set('challan_number')} />
          <Input label="Challan Date" type="date" value={form.challan_date} onChange={set('challan_date')} />
          <Input
            label="Lease Amount (₹)" type="number" step="0.01"
            value={form.lease_amount} onChange={set('lease_amount')}
          />
          <Input
            label="Lease Duration" placeholder="e.g. 99 वर्ष"
            value={form.lease_duration} onChange={set('lease_duration')}
          />
        </Section>

        <Section title="Other">
          <Select
            label="Regulation File Present"
            value={form.regulation_file_present}
            onChange={set('regulation_file_present')}
          >
            {REG_FILE_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </Section>

        <Textarea label="Remarks" value={form.remarks} onChange={set('remarks')} />

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
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function Textarea({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        rows={3}
        className="w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-900 px-3 py-2 shadow-xs
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  )
}
