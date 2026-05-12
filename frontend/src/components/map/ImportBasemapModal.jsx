/**
 * ImportBasemapModal — add a new raster basemap by tile URL template.
 *
 * Persists to /api/gis/basemaps/ so all users see the imported source.
 * The URL must contain literal {z}/{x}/{y} placeholders; the backend
 * serializer rejects anything missing one.
 *
 * Common pre-fills the user can paste in:
 *   - https://tile.openstreetmap.org/{z}/{x}/{y}.png
 *   - https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=YOURKEY
 *   - https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png
 */

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, AlertCircle } from 'lucide-react'

import { gis as gisApi } from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const EMPTY = { name: '', url_template: '', attribution: '', max_zoom: 19 }

export function ImportBasemapModal({ open, onClose }) {
  const queryClient = useQueryClient()
  const [form,   setForm]   = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) { setForm(EMPTY); setErrors({}) }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => gisApi.createBasemap({
      ...form,
      max_zoom: Number(form.max_zoom) || 19,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gis-basemaps'] })
      onClose()
    },
    onError: (err) => {
      setErrors(err.response?.data ?? { _detail: 'Failed to add basemap.' })
    },
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrors({})
    if (!form.name?.trim() || !form.url_template?.trim()) {
      setErrors({ _detail: 'Name and URL template are required.' })
      return
    }
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import Basemap"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>Add Basemap</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Globe className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Paste a tile-server URL with literal <code className="px-1 bg-white rounded">{'{z}/{x}/{y}'}</code> placeholders.
          The new basemap appears under "Base Map" for everyone.
        </div>

        <Input
          label="Name *"
          placeholder="e.g. MapTiler Streets"
          value={form.name}
          onChange={set('name')}
          error={errors.name?.[0]}
          required
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Tile URL Template *</label>
          <input
            type="url"
            placeholder="https://example.com/tiles/{z}/{x}/{y}.png"
            value={form.url_template}
            onChange={set('url_template')}
            required
            spellCheck={false}
            className={`w-full rounded-lg border bg-white text-sm font-mono text-slate-900 px-3 py-2 shadow-xs
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                        ${errors.url_template ? 'border-red-400' : 'border-slate-300'}`}
          />
          {errors.url_template && (
            <p className="text-xs text-red-600">{errors.url_template[0] ?? errors.url_template}</p>
          )}
          <p className="text-[11px] text-slate-500">
            Example: <code>https://tile.openstreetmap.org/{'{z}/{x}/{y}'}.png</code>
          </p>
        </div>

        <Input
          label="Attribution"
          placeholder='© Provider Inc.'
          value={form.attribution}
          onChange={set('attribution')}
          error={errors.attribution?.[0]}
        />

        <Input
          label="Max Zoom"
          type="number"
          min="1" max="22"
          value={form.max_zoom}
          onChange={set('max_zoom')}
          error={errors.max_zoom?.[0]}
        />

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
