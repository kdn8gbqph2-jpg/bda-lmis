/**
 * AddColonyModal — admin-only colony create form.
 *
 * Mirrors ColonyEditModal's field layout: identity, khasra pills, survey,
 * timeline, plot counts (display-only after save), layout file upload,
 * shape/KML upload. POSTs to /api/colonies/.
 *
 * Note: total_plots / available_plots / patta_issued_count are computed
 * server-side from related Plot/Patta records, so they appear on the
 * detail view after creation rather than on this form.
 */

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle, Upload, FileText, X, Download } from 'lucide-react'

import { colonies as coloniesApi, plots as plotsApi } from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { HindiInput, HindiTextarea } from '@/components/ui/HindiInput'

// ── Choice constants (must match backend) ────────────────────────────────────

const COLONY_TYPE_CHOICES = [
  { value: 'bda_scheme',       label: 'BDA Scheme'              },
  { value: 'private_approved', label: 'BDA Approved'            },
  { value: 'suo_moto',         label: 'Regularized Colonies'    },
  { value: 'pending_layout',   label: 'Pending Layout Approval' },
  { value: 'rejected_layout',  label: 'Rejected Layout'         },
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

const MAX_FILE_BYTES = 20 * 1024 * 1024
const LAYOUT_ACCEPT  = '.pdf,.jpeg,.jpg,.png,application/pdf,image/jpeg,image/png'
const SHAPE_ACCEPT   = '.kml,.zip,.kmz,application/vnd.google-earth.kml+xml,application/zip'

// ── Helpers ──────────────────────────────────────────────────────────────────

function pillColor(khasraNumber) {
  let h = 0
  for (const c of String(khasraNumber)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PILL_PALETTE[h % PILL_PALETTE.length]
}

function parseKhasraInput(raw) {
  if (!raw) return []
  const seen = new Set(), out = []
  for (const tok of raw.replace(/\n/g, ',').replace(/;/g, ',').split(',')) {
    const n = tok.trim()
    if (n && !seen.has(n)) { seen.add(n); out.push(n) }
  }
  return out
}

function layoutSlotFor(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase()
  if (ext === 'pdf')                 return 'map_pdf'
  if (ext === 'jpg' || ext === 'jpeg') return 'map_jpeg'
  if (ext === 'png')                 return 'map_png'
  return null
}

const SCALAR_FIELDS = [
  'name', 'colony_type', 'zone', 'status',
  'revenue_village',
  'chak_number', 'dlc_file_number', 'notified_area_bigha',
  'conversion_date', 'layout_application_date', 'layout_approval_date',
  'rejection_reason', 'remarks',
]

const NULLISH_WHEN_EMPTY = new Set([
  'chak_number',
  'dlc_file_number',
  'notified_area_bigha',
  'conversion_date',
  'layout_application_date',
  'layout_approval_date',
])

const EMPTY_FORM = {
  name: '', colony_type: 'bda_scheme', zone: 'East', status: 'active',
  revenue_village: '',
  chak_number: '', dlc_file_number: '', notified_area_bigha: '',
  conversion_date: '', layout_application_date: '', layout_approval_date: '',
  rejection_reason: '', remarks: '',
  khasras_input: '',
}

// ── Component ────────────────────────────────────────────────────────────────

export function AddColonyModal({ open, onClose, onCreated }) {
  const queryClient = useQueryClient()
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState({})
  const [files,   setFiles]   = useState({ map_layout: null, boundary_file: null })
  const [plotsFile, setPlotsFile] = useState(null)
  const [importResult, setImportResult] = useState(null)

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setFiles({ map_layout: null, boundary_file: null })
      setPlotsFile(null)
      setImportResult(null)
      setErrors({})
    }
  }, [open])

  // ── Template download ─────────────────────────────────────────────────────
  const downloadTemplate = async () => {
    const blob = await plotsApi.template()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plots_template.xlsx'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const mutation = useMutation({
    mutationFn: () => {
      const hasFiles = Object.values(files).some(Boolean)
      if (hasFiles) {
        const fd = new FormData()
        for (const f of SCALAR_FIELDS) {
          if (form[f] !== '' && form[f] !== null && form[f] !== undefined) {
            fd.append(f, form[f])
          }
        }
        fd.append('khasras_input', form.khasras_input || '')
        if (files.map_layout) {
          const slot = layoutSlotFor(files.map_layout.name)
          if (slot) fd.append(slot, files.map_layout)
        }
        if (files.boundary_file) fd.append('boundary_file', files.boundary_file)
        return coloniesApi.create(fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      // JSON path
      const payload = {}
      for (const f of SCALAR_FIELDS) {
        const v = form[f]
        if (v === '' || v === null || v === undefined) {
          payload[f] = NULLISH_WHEN_EMPTY.has(f) ? null : ''
        } else {
          payload[f] = v
        }
      }
      payload.khasras_input = form.khasras_input || ''
      if (payload.chak_number !== null) payload.chak_number = Number(payload.chak_number)
      return coloniesApi.create(payload)
    },
    onSuccess: async (data) => {
      // If the user picked a plots template, upload it against the new colony.
      if (plotsFile) {
        try {
          const fd = new FormData()
          fd.append('file', plotsFile)
          fd.append('colony', data.id)
          const result = await plotsApi.bulkImportXlsx(fd)
          setImportResult(result)
        } catch (e) {
          setImportResult({
            _error: e.response?.data?.detail || 'Plot import failed; colony was created.',
          })
        }
      }
      queryClient.invalidateQueries({ queryKey: ['colonies'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['plots'] })
      onCreated?.(data)
      // Close the modal unless we have an import result the user should see
      if (!plotsFile) onClose()
    },
    onError: (err) => {
      setErrors(err.response?.data ?? { _detail: 'Failed to create colony.' })
    },
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleFile = (slot) => (e) => {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_FILE_BYTES) {
      setErrors((p) => ({ ...p, [slot]: [`File exceeds 20 MB limit.`] }))
      return
    }
    setFiles((p) => ({ ...p, [slot]: f }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrors({})
    if (!form.name?.trim()) {
      setErrors({ name: ['Colony name is required.'] })
      return
    }
    mutation.mutate()
  }

  const isRejected = form.colony_type === 'rejected_layout'
  const khasraList = parseKhasraInput(form.khasras_input)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Colony"
      size="lg"
      footer={
        importResult ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button onClick={handleSubmit} loading={mutation.isPending}>
              {plotsFile ? 'Create Colony & Import Plots' : 'Create Colony'}
            </Button>
          </>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">

        <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Creation is recorded in the audit log along with your user ID and timestamp.
        </div>

        <Section title="Identity">
          <HindiInput
            label="Colony Name *"
            value={form.name} onChange={set('name')}
            error={errors.name?.[0]}
            required
          />
          <Select label="Colony Flag" value={form.colony_type} onChange={set('colony_type')}>
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

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Khasra List
          </h3>
          <Input
            label=""
            placeholder="Comma-separated, e.g. 1448, 1449, 1450/1887"
            value={form.khasras_input}
            onChange={set('khasras_input')}
          />
          <div className="flex flex-wrap gap-1.5 mt-3 min-h-[1.75rem]">
            {khasraList.length === 0 && (
              <span className="text-xs text-slate-400">No khasras entered.</span>
            )}
            {khasraList.map((n) => {
              const c = pillColor(n)
              return (
                <span
                  key={n}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}
                >
                  {n}
                </span>
              )
            })}
          </div>
        </div>

        <Section title="Survey">
          <Input
            label="Revenue Village" placeholder="ग्राम का नाम"
            value={form.revenue_village} onChange={set('revenue_village')}
            error={errors.revenue_village?.[0]}
          />
          <Input
            label="Chak Number" type="number"
            value={form.chak_number} onChange={set('chak_number')}
            error={errors.chak_number?.[0]}
          />
          <Input
            label="DLC File Number"
            value={form.dlc_file_number} onChange={set('dlc_file_number')}
            error={errors.dlc_file_number?.[0]}
          />
          <Input
            label="Notified Area (Bigha)" type="number" step="0.01"
            value={form.notified_area_bigha} onChange={set('notified_area_bigha')}
            error={errors.notified_area_bigha?.[0]}
          />
        </Section>

        <Section title="Timeline">
          <Input label="Conversion Date" type="date"
            value={form.conversion_date} onChange={set('conversion_date')} />
          <Input label="Layout Application Date" type="date"
            value={form.layout_application_date} onChange={set('layout_application_date')} />
          <Input label="Layout Approval Date" type="date"
            value={form.layout_approval_date} onChange={set('layout_approval_date')} />
        </Section>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Attach Layout <span className="text-slate-400 normal-case font-normal">· any of .pdf / .jpeg / .png</span>
          </h3>
          <FileSlot
            label="Layout"
            file={files.map_layout}
            accept={LAYOUT_ACCEPT}
            onChange={handleFile('map_layout')}
            error={errors.map_pdf?.[0] || errors.map_jpeg?.[0] || errors.map_png?.[0]}
          />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Shape / KML File <span className="text-slate-400 normal-case font-normal">· .kml / .zip / .kmz</span>
          </h3>
          <FileSlot
            label="Boundary"
            file={files.boundary_file}
            accept={SHAPE_ACCEPT}
            onChange={handleFile('boundary_file')}
            error={errors.boundary_file?.[0]}
          />
        </div>

        {/* ── Plot data import (optional) ────────────────────────────── */}
        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/60">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Plot Data Import <span className="text-slate-400 normal-case font-normal">· optional</span>
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Download the Excel template, fill in your plots, and re-upload below.
            Plots will be created and linked to this colony after it is saved.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template (.xlsx)
            </button>
          </div>
          <FileSlot
            label="Filled Plot Template"
            file={plotsFile}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              if (f && f.size > MAX_FILE_BYTES) {
                setErrors((p) => ({ ...p, plots_file: ['File exceeds 20 MB limit.'] }))
                return
              }
              setPlotsFile(f)
            }}
            error={errors.plots_file?.[0]}
          />
          {importResult && (
            <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${
              importResult._error
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}>
              {importResult._error
                ? importResult._error
                : <>Plot import: <strong>{importResult.created}</strong> created,
                    {' '}<strong>{importResult.updated}</strong> updated
                    {importResult.errors?.length
                      ? <>, <strong>{importResult.errors.length}</strong> errors</>
                      : null}</>
              }
            </div>
          )}
        </div>

        <div className="space-y-4">
          {isRejected && (
            <Textarea
              label="Rejection Reason *"
              value={form.rejection_reason}
              onChange={set('rejection_reason')}
              error={errors.rejection_reason?.[0]}
              hint="Required for rejected layouts. Visible on the public dashboard."
            />
          )}
          <HindiTextarea
            label="Remarks"
            value={form.remarks}
            onChange={set('remarks')}
            error={errors.remarks?.[0]}
          />
        </div>

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

function FileSlot({ label, file, accept, onChange, error }) {
  const inputRef = useRef(null)
  const pickedName = file?.name
  return (
    <div className="border border-dashed border-slate-300 rounded-lg p-3 hover:border-slate-400 transition">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
        >
          <Upload className="w-3.5 h-3.5" /> Choose
        </button>
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={onChange} className="hidden" />
      <div className="text-xs text-slate-500 truncate flex items-center gap-1">
        {pickedName ? (
          <>
            <FileText className="w-3 h-3 text-emerald-600 flex-shrink-0" />
            <span className="text-emerald-700">{pickedName}</span>
            <button
              type="button"
              onClick={() => { onChange({ target: { files: [] } }); if (inputRef.current) inputRef.current.value = '' }}
              className="ml-auto text-slate-400 hover:text-slate-600"
              aria-label="Remove selection"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <span className="text-slate-400">No file selected</span>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

function Textarea({ label, value, onChange, error, hint }) {
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
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
