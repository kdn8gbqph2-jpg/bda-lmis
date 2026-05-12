/**
 * MapPage — GIS map view.
 *
 * Renders a Mapbox-GL canvas with an OpenStreetMap raster base layer
 * centred on Bharatpur. Future iterations will stack GeoJSON overlays
 * (colonies, khasras, plots, custom utility layers) on top of this base.
 */

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const BHARATPUR_CENTER = [77.4933, 27.2152]   // [lng, lat]
const DEFAULT_ZOOM     = 12
const OSM_TILE_URL     = import.meta.env.VITE_OSM_TILE_URL
                      || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export default function MapPage() {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type:        'raster',
            tiles:       [OSM_TILE_URL],
            tileSize:    256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
            maxzoom:     19,
          },
        },
        layers: [
          { id: 'osm-base', type: 'raster', source: 'osm' },
        ],
      },
      center: BHARATPUR_CENTER,
      zoom:   DEFAULT_ZOOM,
      maxZoom: 19,
      attributionControl: { compact: true },
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">GIS Map</h2>
          <p className="text-xs text-slate-500">
            Bharatpur, Rajasthan · base map: OpenStreetMap
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {OSM_TILE_URL.replace(/^https?:\/\//, '').split('/')[0]}
        </span>
      </div>

      <div
        ref={containerRef}
        className="w-full h-[calc(100vh-12rem)] rounded-xl border border-slate-200 shadow-sm overflow-hidden"
      />
    </div>
  )
}
