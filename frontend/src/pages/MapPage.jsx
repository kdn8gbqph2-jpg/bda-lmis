/**
 * MapPage — GIS map view.
 *
 * MapLibre-GL canvas centred on Bharatpur. A small floating panel lets
 * the user switch between four keyless base layers — OSM Standard, OSM
 * Humanitarian, Carto Light, and Carto Dark. All speak the same
 * {z}/{x}/{y} tile contract so swapping is just changing the source's
 * `tiles` array.
 *
 * MapLibre rather than Mapbox-GL because Mapbox 2+ silently refuses to
 * render without an access token, even on fully-custom styles. MapLibre
 * is the open-source fork built for this exact use case.
 *
 * Future iterations will stack GeoJSON overlays (colonies, khasras,
 * plots, custom utility layers) on top of whichever base is active.
 */

import { useEffect, useRef, useState } from 'react'
import { Layers, Check } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const BHARATPUR_CENTER = [77.4933, 27.2152]   // [lng, lat]
const DEFAULT_ZOOM     = 12

// ── Available base layers (all keyless) ───────────────────────────────────────

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
    tiles: [
      'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    ],
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Humanitarian style by <a href="https://www.hotosm.org/" target="_blank" rel="noreferrer">HOT</a>',
    maxzoom: 20,
  },
  {
    id:    'carto_light',
    label: 'Carto Light',
    tiles: [
      'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    ],
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    maxzoom: 20,
  },
  {
    id:    'carto_dark',
    label: 'Carto Dark',
    tiles: [
      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    ],
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    maxzoom: 20,
  },
]

const DEFAULT_LAYER_ID = 'osm_standard'

function styleFor(layer) {
  return {
    version: 8,
    sources: {
      base: {
        type:        'raster',
        tiles:       layer.tiles,
        tileSize:    256,
        attribution: layer.attribution,
        maxzoom:     layer.maxzoom,
      },
    },
    layers: [{ id: 'base-layer', type: 'raster', source: 'base' }],
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const [layerId, setLayerId] = useState(DEFAULT_LAYER_ID)

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

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Swap base layer when the user picks a different option
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layer = BASE_LAYERS.find((l) => l.id === layerId)
    if (!layer) return
    // setStyle preserves the camera; we don't have overlays yet, so this is
    // the cleanest swap. When overlays exist, re-add them in the styledata
    // event handler.
    map.setStyle(styleFor(layer))
  }, [layerId])

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">GIS Map</h2>
          <p className="text-xs text-slate-500">
            Bharatpur, Rajasthan · base: {BASE_LAYERS.find((l) => l.id === layerId)?.label}
          </p>
        </div>
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="w-full h-[calc(100vh-12rem)] rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        />
        <LayerSwitcher
          layers={BASE_LAYERS}
          active={layerId}
          onChange={setLayerId}
        />
      </div>
    </div>
  )
}

// ── Layer switcher (floating panel, top-left of the map) ─────────────────────

function LayerSwitcher({ layers, active, onChange }) {
  const [open, setOpen] = useState(false)
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
        <div className="mt-2 w-52 bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100">
            Base Map
          </div>
          {layers.map((l) => {
            const isActive = l.id === active
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => { onChange(l.id); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left
                            transition-colors ${
                              isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                            }`}
              >
                <span>{l.label}</span>
                {isActive && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
