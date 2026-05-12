/**
 * UploadLayerModal — admin/staff form to add a custom map overlay.
 *
 * POSTs multipart/form-data to /api/gis/custom-layers/. The file may be
 * a .geojson, .json, or zipped Shapefile (.zip). Style is stored as a
 * JSONB blob the renderer reads when toggling the layer on the map.
 */

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, X, AlertCircle } from 'lucide-react'

import { gis as gisApi } from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'

const LAYER_TYPES = [
  { value: 'OTHER',       label: 'Other'        },
  { value: 'WATER',       label: 'Water'        },
  { value: 'SEWERAGE',    label: 'Sewerage'     },
  { value: 'ELECTRICITY', label: 'Electricity'  },
  { value: 'ROADS',       label: 'Roads'        },
  { value: 'DRAINAGE',    label: 'Drainage'     },
]

const DEFAULT_COLOUR = '#2563EB'
const MAX_FILE_BYTES = 20 * 1024 * 1024
const ACCEPT = '.geojson,.json,.zip,application/json,application/zip'

export function UploadLayerModal({ open, onClose }) {
  const queryClient = useQueryClient()
  const [form,   setForm]   = useState({
    name: '', layer_type: 'OTHER',
    stroke_color: DEFAULT_COLOUR, fill_color: DEFAULT_COLOUR,
    stroke_width: 2, opacity: 0.7,
  })
  const [file,   setFile]   = useState(null)
  const [errors, setErrors] = useState({})
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setForm({
        name: '', layer_type: 'OTHER',
        stroke_color: DEFAULT_COLOUR, fill_color: DEFAULT_COLOUR,
        stroke_width: 2, opacity: 0.7,
      })
      setFile(null)
      setErrors({})
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', form.name)
      fd.append('layer_type', form.layer_type)
      fd.append('style', JSON.stringify({
        stroke_color: form.stroke_color,
        stroke_width: Number(form.stroke_width),
        fill_color:   form.fill_color,
        opacity:      Number(form.opacity),
      }))
      fd.append('is_public', 'true')
      return gisApi.uploadLayer(fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gis-layers'] })
      onClose()
    },
    onError: (err) => {
      setErrors(err.response?.data ?? { _detail: 'Failed to upload layer.' })
    },
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrors({})
    if (!file)        return setErrors({ file: ['Choose a file first.'] })
    if (!form.name)   return setErrors({ name: ['Layer name is required.'] })
    mutation.mutate()
  }

  const handleFile = (e) => {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_FILE_BYTES) {
      setErrors({ file: ['File exceeds 20 MB.'] })
      return
    }
    setFile(f)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Custom Layer"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>Upload</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* File picker */}
        <div className="border border-dashed border-slate-300 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-slate-700">Source file</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
            >
              <Upload className="w-3.5 h-3.5" /> Choose
            </button>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleFile} className="hidden" />
          <div className="text-xs text-slate-500 truncate flex items-center gap-1">
            {file ? (
              <>
                <FileText className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                <span className="text-emerald-700">{file.name}</span>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = '' }}
                  className="ml-auto text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : <span className="text-slate-400">.geojson, .json, or .zip (Shapefile)</span>}
          </div>
          {errors.file?.[0] && <p className="text-xs text-red-600 mt-1">{errors.file[0]}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Layer Name *"
            placeholder="e.g. Water Mains – West Zone"
            value={form.name}
            onChange={set('name')}
            error={errors.name?.[0]}
            required
          />
          <Select label="Type" value={form.layer_type} onChange={set('layer_type')}>
            {LAYER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Style</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ColourPicker label="Stroke" value={form.stroke_color} onChange={set('stroke_color')} />
            <ColourPicker label="Fill"   value={form.fill_color}   onChange={set('fill_color')} />
            <Input
              label="Stroke Width" type="number" min="0" step="0.5"
              value={form.stroke_width} onChange={set('stroke_width')}
            />
            <Input
              label="Opacity" type="number" min="0" max="1" step="0.05"
              value={form.opacity} onChange={set('opacity')}
            />
          </div>
        </div>

        {errors._detail && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errors._detail}</span>
          </div>
        )}
      </form>
    </Modal>
  )
}

function ColourPicker({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-2 px-2 py-1.5 border border-slate-300 rounded-lg bg-white">
        <input type="color" value={value} onChange={onChange}
               className="w-6 h-6 cursor-pointer rounded" />
        <span className="text-xs font-mono text-slate-600 tabular-nums">{value}</span>
      </div>
    </div>
  )
}
