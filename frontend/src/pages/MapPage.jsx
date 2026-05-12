/**
 * MapPage — GIS map with switchable base layer + custom overlays.
 *
 * Architecture:
 *   - Base layer: one of four keyless OSM/Carto raster styles, swapped
 *     via map.setStyle() which wipes existing layers.
 *   - Custom overlays: list fetched from /api/gis/custom-layers/ and
 *     rendered as toggleable items in the side panel. Each overlay's
 *     GeoJSON is fetched on toggle-on and stays cached in component
 *     state. A `styledata` listener re-applies all active overlays
 *     after every base-layer swap so we never lose them.
 *
 * Uses MapLibre-GL (not Mapbox) because Mapbox 2+ silently refuses to
 * render without an access token.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Layers, Check, Plus, Trash2, ChevronDown, ChevronRight, Upload } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { gis as gisApi } from '@/api/endpoints'
import { useAuthStore } from '@/stores/useAuthStore'
import { UploadLayerModal } from '@/components/map/UploadLayerModal'

const BHARATPUR_CENTER = [77.4933, 27.2152]
const DEFAULT_ZOOM     = 12

// ── Available base layers (keyless) ──────────────────────────────────────────

const BASE_LAYERS = [
  {
    id:    'osm_standard',
    label: 'OSM Standard',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxzoom: 19,
  },
  {
    id:    'osm_humanitarian',
    label: 'OSM Humanitarian',
    tiles: ['https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'],
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · HOT',
    maxzoom: 20,
  },
  {
    id:    'carto_light',
    label: 'Carto Light',
    tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · © CARTO',
    maxzoom: 20,
  },
  {
    id:    'carto_dark',
    label: 'Carto Dark',
    tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · © CARTO',
    maxzoom: 20,
  },
]

const DEFAULT_LAYER_ID = 'osm_standard'

function styleFor(layer) {
  return {
    version: 8,
    sources: {
      base: {
        type: 'raster', tiles: layer.tiles, tileSize: 256,
        attribution: layer.attribution, maxzoom: layer.maxzoom,
      },
    },
    layers: [{ id: 'base-layer', type: 'raster', source: 'base' }],
  }
}

// ── Overlay rendering ────────────────────────────────────────────────────────

const OVERLAY_PREFIX = 'overlay-'

/**
 * Render one GeoJSON layer on the map.  Adds three layers (fill/line/circle)
 * so any geometry type renders with the layer's style.
 */
function addOverlay(map, id, geojson, style = {}) {
  const sourceId = `${OVERLAY_PREFIX}${id}`
  const fillId   = `${sourceId}-fill`
  const lineId   = `${sourceId}-line`
  const pointId  = `${sourceId}-point`

  if (map.getSource(sourceId)) return   // already added

  map.addSource(sourceId, { type: 'geojson', data: geojson })

  const stroke  = style.stroke_color ?? '#2563EB'
  const fill    = style.fill_color   ?? stroke
  const width   = style.stroke_width ?? 2
  const opacity = style.opacity      ?? 0.6

  map.addLayer({
    id: fillId, source: sourceId, type: 'fill',
    paint: { 'fill-color': fill, 'fill-opacity': opacity },
    filter: ['==', ['geometry-type'], 'Polygon'],
  })
  map.addLayer({
    id: lineId, source: sourceId, type: 'line',
    paint: { 'line-color': stroke, 'line-width': width, 'line-opacity': 0.95 },
    filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']]],
  })
  map.addLayer({
    id: pointId, source: sourceId, type: 'circle',
    paint: {
      'circle-radius': 5,
      'circle-color': stroke,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
    },
    filter: ['==', ['geometry-type'], 'Point'],
  })
}

function removeOverlay(map, id) {
  const sourceId = `${OVERLAY_PREFIX}${id}`
  for (const suffix of ['-fill', '-line', '-point']) {
    const layerId = `${sourceId}${suffix}`
    if (map.getLayer(layerId)) map.removeLayer(layerId)
  }
  if (map.getSource(sourceId)) map.removeSource(sourceId)
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const queryClient  = useQueryClient()
  const isStaff      = useAuthStore((s) => s.isStaffOrAbove)()
  const isAdmin      = useAuthStore((s) => s.isAdmin)()

  const [baseLayerId, setBaseLayerId] = useState(DEFAULT_LAYER_ID)
  const [activeOverlays, setActiveOverlays] = useState(() => new Set())
  // Cache of fetched geojson keyed by layer id (so re-applying after a base
  // swap doesn't refetch).
  const overlayDataRef = useRef(new Map())
  const [uploadOpen, setUploadOpen] = useState(false)

  // Pull the list of custom layers
  const layersQ = useQuery({
    queryKey: ['gis-layers'],
    queryFn:  gisApi.layers,
    staleTime: 60_000,
  })
  const customLayers = layersQ.data?.results ?? layersQ.data ?? []

  // Apply / refresh overlays whenever the active set changes or the style reloads.
  const reapplyOverlays = useCallback(async () => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    for (const id of activeOverlays) {
      const sourceId = `${OVERLAY_PREFIX}${id}`
      if (map.getSource(sourceId)) continue
      let geojson = overlayDataRef.current.get(id)
      if (!geojson) {
        try {
          geojson = await gisApi.layerGeojson(id)
          overlayDataRef.current.set(id, geojson)
        } catch {
          continue
        }
      }
      const meta = customLayers.find((l) => l.id === id) ?? {}
      addOverlay(map, id, geojson, meta.style ?? {})
    }
    // Remove any overlays that the source map still has but state has dropped
    for (const layer of customLayers) {
      if (!activeOverlays.has(layer.id)) {
        if (map.getSource(`${OVERLAY_PREFIX}${layer.id}`)) {
          removeOverlay(map, layer.id)
        }
      }
    }
  }, [activeOverlays, customLayers])

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const initial = BASE_LAYERS.find((l) => l.id === DEFAULT_LAYER_ID) ?? BASE_LAYERS[0]

    const map = new maplibregl.Map({
      container: containerRef.current,
      style:     styleFor(initial),
      center:    BHARATPUR_CENTER,
      zoom:      DEFAULT_ZOOM,
      maxZoom:   20,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    // Re-attach active overlays after every base-style swap
    map.on('styledata', () => { reapplyOverlays() })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap base layer when picked
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layer = BASE_LAYERS.find((l) => l.id === baseLayerId)
    if (layer) map.setStyle(styleFor(layer))
  }, [baseLayerId])

  // React to overlay set changes (additions only — removals also handled)
  useEffect(() => { reapplyOverlays() }, [reapplyOverlays])

  const toggleOverlay = (id) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const deleteMut = useMutation({
    mutationFn: (id) => gisApi.deleteLayer(id),
    onSuccess: (_data, id) => {
      activeOverlays.delete(id)
      overlayDataRef.current.delete(id)
      const map = mapRef.current
      if (map) removeOverlay(map, id)
      queryClient.invalidateQueries({ queryKey: ['gis-layers'] })
    },
  })

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">GIS Map</h2>
          <p className="text-xs text-slate-500">
            Bharatpur, Rajasthan · base: {BASE_LAYERS.find((l) => l.id === baseLayerId)?.label}
            {' · '}{activeOverlays.size} overlay{activeOverlays.size === 1 ? '' : 's'} active
          </p>
        </div>
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="w-full h-[calc(100vh-12rem)] rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        />

        <LayerPanel
          baseLayers={BASE_LAYERS}
          activeBase={baseLayerId}
          onBaseChange={setBaseLayerId}
          overlays={customLayers}
          activeOverlays={activeOverlays}
          onToggleOverlay={toggleOverlay}
          onDeleteOverlay={(id) => deleteMut.mutate(id)}
          canUpload={isStaff}
          canDelete={isAdmin}
          onUploadClick={() => setUploadOpen(true)}
          loading={layersQ.isPending}
        />
      </div>

      <UploadLayerModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  )
}

// ── Layer panel (floating top-left) ──────────────────────────────────────────

function LayerPanel({
  baseLayers, activeBase, onBaseChange,
  overlays, activeOverlays, onToggleOverlay, onDeleteOverlay,
  canUpload, canDelete, onUploadClick,
  loading,
}) {
  const [open,        setOpen]       = useState(true)
  const [createOpen,  setCreateOpen] = useState(false)
  return (
    <div className="absolute top-3 left-3 z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg
                   shadow-sm px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Layers className="w-4 h-4 text-slate-500" />
        Layers
      </button>

      {open && (
        <div className="mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-md max-h-[calc(100vh-16rem)] overflow-y-auto">

          {/* Base maps */}
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100">
            Base Map
          </div>
          {baseLayers.map((l) => {
            const isActive = l.id === activeBase
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => onBaseChange(l.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{l.label}</span>
                {isActive && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            )
          })}

          {/* Custom overlays */}
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-y border-slate-100">
            Overlays
          </div>

          {loading ? (
            <div className="px-3 py-3 text-xs text-slate-400">Loading…</div>
          ) : overlays.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400">
              No overlays yet. Upload a GeoJSON or Shapefile to get started.
            </div>
          ) : overlays.map((l) => {
            const isOn = activeOverlays.has(l.id)
            const colour = l.style?.stroke_color ?? '#2563EB'
            return (
              <div
                key={l.id}
                className={`group px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isOn ? 'bg-slate-50' : 'hover:bg-slate-50'
                }`}
              >
                <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => onToggleOverlay(l.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: colour }}
                  />
                  <span className="truncate text-slate-800">{l.name}</span>
                </label>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete layer "${l.name}"?`)) onDeleteOverlay(l.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition"
                    title="Delete layer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}

          {/* Create custom layer (staff+) */}
          {canUpload && (
            <div className="border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium
                           text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {createOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span>Create Custom Layer</span>
              </button>
              {createOpen && (
                <div className="pl-7 pb-2">
                  <button
                    type="button"
                    onClick={onUploadClick}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md
                               text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">Import Layer</div>
                      <div className="text-[10px] text-slate-400 leading-tight">
                        .kml / .kmz / .geojson / .zip
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
