/**
 * ColonyEditModal — admin-only colony edit form.
 *
 * Implements the admin spec: name, colony-type flag, khasra pills,
 * layout dates, computed plot counts (total / available / patta-issued),
 * layout file uploads (PDF/JPEG/PNG) and a boundary shape/KML upload.
 *
 * Sends multipart/form-data when any file slot is touched so DRF can
 * accept the FileField uploads; falls back to JSON otherwise.
 *
 * Backend audit signals automatically record old/new values + the
 * editing user on every save.
 */

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle, Upload, FileText, X } from 'lucide-react'

import { colonies as coloniesApi } from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'

// ── Choice constants — labels must match the user-facing flag spec ────────────

const COLONY_TYPE_CHOICES = [
  { value: 'bda_scheme',       label: 'BDA Scheme'              },
  { value: 'private_approved', label: 'BDA Approved'            },
  { value: 'suo_moto',         label: 'SUO-Moto'                },
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

// Stable color palette for khasra pills. Each khasra gets a deterministic
// color based on its number's hash so the same khasra stays the same color.
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

const MAX_FILE_BYTES = 20 * 1024 * 1024   // 20 MB
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

const SCALAR_FIELDS = [
  'name', 'colony_type', 'zone', 'status',
  'revenue_village',
  'chak_number', 'dlc_file_number', 'notified_area_bigha',
  'conversion_date', 'layout_application_date', 'layout_approval_date',
  'rejection_reason', 'remarks',
]

// Fields where the model column is `null=True` — empty input should be sent
// as JSON null rather than empty string. The rest are TextField(blank=True)
// without null=True (rejection_reason, remarks, name, colony_type, zone,
// status) and reject null at validation time.
const NULLISH_WHEN_EMPTY = new Set([
  'chak_number',
  'dlc_file_number',
  'notified_area_bigha',
  'conversion_date',
  'layout_application_date',
  'layout_approval_date',
])

function fromColony(colony) {
  const out = {}
  for (const f of SCALAR_FIELDS) out[f] = colony?.[f] ?? ''
  out.khasras_input = (colony?.khasras ?? []).map((k) => k.number).join(', ')
  return out
}

// ── Component ────────────────────────────────────────────────────────────────

export function ColonyEditModal({ colony, open, onClose, onSaved }) {
  const queryClient = useQueryClient()
  const [form, setForm]     = useState(() => fromColony(colony))
  const [errors, setErrors] = useState({})

  // File slots — null means "don't touch this server-side"
  const [files, setFiles] = useState({
    map_pdf: null, map_jpeg: null, map_png: null, boundary_file: null,
  })

  useEffect(() => {
    if (open) {
      setForm(fromColony(colony))
      setFiles({ map_pdf: null, map_jpeg: null, map_png: null, boundary_file: null })
      setErrors({})
    }
  }, [open, colony])

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
        for (const [k, v] of Object.entries(files)) if (v) fd.append(k, v)
        return coloniesApi.update(colony.id, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
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
      return coloniesApi.update(colony.id, payload)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['colonies'] })
      queryClient.invalidateQueries({ queryKey: ['colony', colony.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onSaved?.(data)
      onClose()
    },
    onError: (err) => {
      setErrors(err.response?.data ?? { _detail: 'Failed to save changes.' })
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
    mutation.mutate()
  }

  const isRejected = form.colony_type === 'rejected_layout'
  const khasraList = parseKhasraInput(form.khasras_input)

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
      <form onSubmit={handleSubmit} className="space-y-6">

        <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          All edits are recorded in the audit log along with your user ID and timestamp.
        </div>

        {/* Identity + flag */}
        <Section title="Identity">
          <Input
            label="Colony Name"
            value={form.name}
            onChange={set('name')}
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

        {/* Khasras */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Khasra List
          </h3>
          <Input
            label=""
            placeholder="Comma-separated, e.g. 1448, 1449, 1450/1887"
            value={form.khasras_input}
            onChange={set('khasras_input')}
            error={errors.khasras_input?.[0]}
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

        {/* Survey */}
        <Section title="Survey">
          <Input
            label="Revenue Village"
            placeholder="ग्राम का नाम"
            value={form.revenue_village ?? ''} onChange={set('revenue_village')}
            error={errors.revenue_village?.[0]}
          />
          <Input
            label="Chak Number" type="number"
            value={form.chak_number ?? ''} onChange={set('chak_number')}
            error={errors.chak_number?.[0]}
          />
          <Input
            label="DLC File Number"
            value={form.dlc_file_number ?? ''} onChange={set('dlc_file_number')}
            error={errors.dlc_file_number?.[0]}
          />
          <Input
            label="Notified Area (Bigha)" type="number" step="0.01"
            value={form.notified_area_bigha ?? ''} onChange={set('notified_area_bigha')}
            error={errors.notified_area_bigha?.[0]}
          />
        </Section>

        {/* Timeline */}
        <Section title="Timeline">
          <Input
            label="Conversion Date" type="date"
            value={form.conversion_date ?? ''} onChange={set('conversion_date')}
          />
          <Input
            label="Layout Application Date" type="date"
            value={form.layout_application_date ?? ''} onChange={set('layout_application_date')}
          />
          <Input
            label="Layout Approval Date" type="date"
            value={form.layout_approval_date ?? ''} onChange={set('layout_approval_date')}
          />
        </Section>

        {/* Plot counts — read-only computed */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Plot Counts <span className="text-slate-400 normal-case font-normal">· auto-computed</span>
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <ReadOnlyStat label="Total Plots"        value={colony?.total_plots} />
            <ReadOnlyStat label="Available Plots"    value={colony?.available_plots} />
            <ReadOnlyStat label="Patta Issued Count" value={colony?.patta_issued_count} />
          </div>
        </div>

        {/* Layout files */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Attach Layout <span className="text-slate-400 normal-case font-normal">· .pdf / .jpeg / .png</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FileSlot
              label="PDF"  current={colony?.map_pdf}  file={files.map_pdf}
              accept={LAYOUT_ACCEPT} onChange={handleFile('map_pdf')}
              error={errors.map_pdf?.[0]}
            />
            <FileSlot
              label="JPEG" current={colony?.map_jpeg} file={files.map_jpeg}
              accept={LAYOUT_ACCEPT} onChange={handleFile('map_jpeg')}
              error={errors.map_jpeg?.[0]}
            />
            <FileSlot
              label="PNG"  current={colony?.map_png}  file={files.map_png}
              accept={LAYOUT_ACCEPT} onChange={handleFile('map_png')}
              error={errors.map_png?.[0]}
            />
          </div>
        </div>

        {/* Shape / KML file */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Shape / KML File <span className="text-slate-400 normal-case font-normal">· .kml / .zip / .kmz</span>
          </h3>
          <FileSlot
            label="Boundary"
            current={colony?.boundary_file}
            file={files.boundary_file}
            accept={SHAPE_ACCEPT}
            onChange={handleFile('boundary_file')}
            error={errors.boundary_file?.[0]}
          />
        </div>

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

function ReadOnlyStat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-900 tabular-nums leading-tight mt-0.5">
        {value ?? '—'}
      </div>
    </div>
  )
}

function FileSlot({ label, current, file, accept, onChange, error }) {
  const inputRef = useRef(null)
  const pickedName = file?.name
  const currentName = current ? current.split('/').pop() : null

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
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="hidden"
      />
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
        ) : currentName ? (
          <>
            <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="truncate">{currentName}</span>
          </>
        ) : (
          <span className="text-slate-400">No file uploaded</span>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
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
