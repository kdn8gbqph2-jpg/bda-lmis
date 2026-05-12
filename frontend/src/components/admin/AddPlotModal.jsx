/**
 * AddPlotModal — staff/admin form to create a new plot record.
 *
 * Required by the backend serializer: plot_number, colony, primary_khasra,
 * type. The khasra dropdown is filtered to the selected colony so the
 * "primary khasra must belong to the colony" validator on the server
 * never fails for a properly-completed form.
 */

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle } from 'lucide-react'

import { plots as plotsApi, colonies as coloniesApi, khasras as khasrasApi } from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { HindiTextarea } from '@/components/ui/HindiInput'

const TYPE_CHOICES = [
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial',  label: 'Commercial'  },
]

const STATUS_CHOICES = [
  { value: 'available',          label: 'Available'           },
  { value: 'allotted_lottery',   label: 'Allotted (Lottery)'  },
  { value: 'allotted_seniority', label: 'Allotted (Seniority)'},
  { value: 'ews',                label: 'EWS'                 },
  { value: 'patta_ok',           label: 'Patta OK'            },
  { value: 'patta_missing',      label: 'Patta Missing'       },
  { value: 'cancelled',          label: 'Cancelled'           },
]

const EMPTY = {
  plot_number: '',
  colony: '',
  primary_khasra: '',
  type: 'Residential',
  area_sqy: '',
  status: 'available',
  remarks: '',
}

function cleanPayload(form) {
  const out = { ...form }
  if (out.colony !== '')         out.colony         = Number(out.colony)
  if (out.primary_khasra !== '') out.primary_khasra = Number(out.primary_khasra)
  if (out.area_sqy === '')       out.area_sqy       = null
  out.remarks = out.remarks ?? ''
  return out
}

export function AddPlotModal({ open, onClose, onCreated, defaultColonyId = '' }) {
  const queryClient = useQueryClient()
  const [form,   setForm]   = useState({ ...EMPTY, colony: defaultColonyId })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, colony: defaultColonyId })
      setErrors({})
    }
  }, [open, defaultColonyId])

  // Colonies for the dropdown
  const coloniesQ = useQuery({
    queryKey: ['colonies-select'],
    queryFn:  () => coloniesApi.list({ page_size: 200 }),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })
  const colonyOptions = coloniesQ.data?.results ?? []

  // Khasras filtered to the selected colony
  const khasrasQ = useQuery({
    queryKey: ['khasras-for-colony', form.colony],
    queryFn:  () => khasrasApi.list({ colony: form.colony, page_size: 500 }),
    staleTime: 5 * 60 * 1000,
    enabled: !!form.colony && open,
  })
  const khasraOptions = khasrasQ.data?.results ?? khasrasQ.data ?? []

  const mutation = useMutation({
    mutationFn: () => plotsApi.create(cleanPayload(form)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plots'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onCreated?.(data)
      onClose()
    },
    onError: (err) => {
      setErrors(err.response?.data ?? { _detail: 'Failed to create plot.' })
    },
  })

  const set = (k) => (e) => {
    const v = e.target.value
    setForm((f) => {
      const next = { ...f, [k]: v }
      // Reset primary_khasra if colony changes
      if (k === 'colony' && v !== f.colony) next.primary_khasra = ''
      return next
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrors({})
    if (!form.plot_number || !form.colony || !form.primary_khasra) {
      setErrors({ _detail: 'Plot number, colony, and primary khasra are required.' })
      return
    }
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Plot"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>Create Plot</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Creation is recorded in the audit log along with your user ID and timestamp.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Plot Number *"
            placeholder="e.g. 1A"
            value={form.plot_number}
            onChange={set('plot_number')}
            error={errors.plot_number?.[0]}
            required
          />
          <Select label="Type" value={form.type} onChange={set('type')}>
            {TYPE_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Colony *" value={form.colony} onChange={set('colony')}>
            <option value="">— select colony —</option>
            {colonyOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select
            label="Primary Khasra *"
            value={form.primary_khasra}
            onChange={set('primary_khasra')}
            disabled={!form.colony || khasrasQ.isPending}
          >
            <option value="">
              {!form.colony ? '— select colony first —'
               : khasrasQ.isPending ? 'Loading khasras…'
               : khasraOptions.length === 0 ? 'No khasras in this colony'
               : '— select khasra —'}
            </option>
            {khasraOptions.map((k) => (
              <option key={k.id} value={k.id}>{k.number}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Area (Sq. Yards)"
            type="number" step="0.01"
            placeholder="e.g. 120.5"
            value={form.area_sqy}
            onChange={set('area_sqy')}
            error={errors.area_sqy?.[0]}
          />
          <Select label="Status" value={form.status} onChange={set('status')}>
            {STATUS_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>

        <HindiTextarea
          label="Remarks"
          placeholder="Internal notes about this plot…"
          value={form.remarks}
          onChange={set('remarks')}
          error={errors.remarks?.[0]}
        />

        {(errors._detail || errors.primary_khasra) && (
          <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errors._detail ?? errors.primary_khasra?.[0]}</span>
          </div>
        )}
      </form>
    </Modal>
  )
}
