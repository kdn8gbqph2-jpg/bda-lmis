/**
 * PlotEditModal — staff/admin form to update an existing plot.
 *
 * Wraps PUT /api/plots/{id}/. Primary-khasra dropdown is scoped to the
 * plot's colony (the server-side validator rejects cross-colony pairs).
 * Backend audit signals + geojson-cache busts run automatically.
 */

import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle } from 'lucide-react'

import {
  plots as plotsApi,
  khasras as khasrasApi,
  approvals as approvalsApi,
  auditLogs as auditApi,
} from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { HindiTextarea } from '@/components/ui/HindiInput'
import { PendingFieldChip } from '@/components/approvals/PendingFieldChip'
import { PendingBanner } from '@/components/approvals/PendingBanner'
import { buildRecentApprovalMap } from '@/components/approvals/recentApprovalMap'
import { EditHistory } from '@/components/history/EditHistory'

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

function fromPlot(plot) {
  return {
    plot_number:    plot?.plot_number    ?? '',
    primary_khasra: plot?.primary_khasra ?? '',
    type:           plot?.type           ?? 'Residential',
    area_sqy:       plot?.area_sqy       ?? '',
    status:         plot?.status         ?? 'available',
    remarks:        plot?.remarks        ?? '',
  }
}

function cleanPayload(plot, form) {
  return {
    plot_number:    form.plot_number,
    colony:         plot.colony,                       // immutable here
    primary_khasra: form.primary_khasra ? Number(form.primary_khasra) : null,
    type:           form.type,
    area_sqy:       form.area_sqy === '' ? null : form.area_sqy,
    status:         form.status,
    remarks:        form.remarks ?? '',
  }
}

export function PlotEditModal({ plot, open, onClose, onSaved }) {
  const queryClient = useQueryClient()
  const [form,   setForm]   = useState(() => fromPlot(plot))
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) { setForm(fromPlot(plot)); setErrors({}) }
  }, [open, plot])

  // Khasras filtered to the plot's colony (FK can't change here)
  const khasrasQ = useQuery({
    queryKey: ['khasras-for-colony', plot?.colony],
    queryFn:  () => khasrasApi.list({ colony: plot.colony, page_size: 500 }),
    staleTime: 5 * 60 * 1000,
    enabled: !!plot?.colony && open,
  })
  const khasraOptions = khasrasQ.data?.results ?? khasrasQ.data ?? []

  // Pending ChangeRequest for this plot — drives the per-field
  // "Pending approval" badges on the form labels below.
  const pendingQ = useQuery({
    queryKey: ['approvals', 'pending', 'plot', plot?.id],
    queryFn:  () => approvalsApi.list({
      target_type: 'plot', target_id: plot?.id, status: 'pending', page_size: 1,
    }),
    enabled: open && !!plot?.id,
    staleTime: 30_000,
  })
  const pendingCR = pendingQ.data?.results?.[0]

  // Recent audit-log entries — drives the transient green "Approved"
  // chip on fields whose last change came through an approved CR within
  // the past 24h. Same endpoint EditHistory uses below.
  const recentAuditQ = useQuery({
    queryKey: ['audit', 'plot', plot?.id, 'recent'],
    queryFn:  () => auditApi.list({ entity_type: 'plot', entity_id: plot?.id, page_size: 20 }),
    enabled:  open && !!plot?.id,
    staleTime: 30_000,
  })
  const recentApprovals = useMemo(
    () => buildRecentApprovalMap(recentAuditQ.data?.results ?? []),
    [recentAuditQ.data],
  )

  const chip = (fieldKey) => (
    <PendingFieldChip
      fieldKey={fieldKey}
      record={plot}
      pendingCR={pendingCR}
      formValue={form[fieldKey]}
      recentApproval={recentApprovals[fieldKey]}
    />
  )

  const mutation = useMutation({
    mutationFn: () => plotsApi.update(plot.id, cleanPayload(plot, form)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plots'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      // Refresh the bell badge and Edit History timeline immediately —
      // staff saves create a new pending CR; admin saves write a new
      // AuditLog row. Either way the chip lifecycle on next open needs
      // current data.
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
    if (!form.plot_number || !form.primary_khasra) {
      setErrors({ _detail: 'Plot number and primary khasra are required.' })
      return
    }
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Plot — ${plot?.plot_number ?? ''}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>Save Changes</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Top-of-modal banner — surfaces a pending CR on revisit so staff
            (and resolvers) see what's awaiting approval without scanning
            every field's label chip. */}
        {pendingCR && <PendingBanner cr={pendingCR} record={plot} onResolved={onClose} />}

        <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          All edits are recorded in the audit log along with your user ID and timestamp.
        </div>

        {/* Colony — display only */}
        <div>
          <label className="text-sm font-medium text-slate-700">Colony</label>
          <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {plot?.colony_name ?? '—'}
            <span className="text-xs text-slate-400 ml-2">(immutable here)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Plot Number *"
            value={form.plot_number}
            onChange={set('plot_number')}
            error={errors.plot_number?.[0]}
            labelExtra={chip('plot_number')}
            required
          />
          <Select
            label="Type"
            value={form.type}
            onChange={set('type')}
            labelExtra={chip('type')}
          >
            {TYPE_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Primary Khasra *"
            value={form.primary_khasra}
            onChange={set('primary_khasra')}
            disabled={khasrasQ.isPending || khasraOptions.length === 0}
            labelExtra={chip('primary_khasra')}
          >
            <option value="">
              {khasrasQ.isPending ? 'Loading…'
               : khasraOptions.length === 0 ? 'No khasras in this colony'
               : '— select khasra —'}
            </option>
            {khasraOptions.map((k) => (
              <option key={k.id} value={k.id}>{k.number}</option>
            ))}
          </Select>
          <Input
            label="Area (Sq. Yards)" type="number" step="0.01"
            value={form.area_sqy ?? ''} onChange={set('area_sqy')}
            error={errors.area_sqy?.[0]}
            labelExtra={chip('area_sqy')}
          />
        </div>

        <Select
          label="Status"
          value={form.status}
          onChange={set('status')}
          labelExtra={chip('status')}
        >
          {STATUS_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>

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

      {plot?.id && (
        <div className="mt-6">
          <EditHistory entityType="plot" entityId={plot.id} />
        </div>
      )}
    </Modal>
  )
}
