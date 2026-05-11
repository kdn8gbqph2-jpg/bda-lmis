/**
 * MapPreview — placeholder GIS map panel for the public dashboard.
 *
 * Renders a styled empty-state with mock layer toggles and a marker grid,
 * ready to be replaced by a real Mappls / Mapbox GL view later.
 * No external map dependency is loaded yet — this is intentionally a stub.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Map as MapIcon, Layers, Maximize2, MapPin,
} from 'lucide-react'

const LAYERS = [
  { id: 'colonies', label: 'Colonies',  color: 'bg-blue-500',    enabled: true  },
  { id: 'khasras',  label: 'Khasras',   color: 'bg-amber-500',   enabled: false },
  { id: 'utility',  label: 'Utility',   color: 'bg-emerald-500', enabled: false },
  { id: 'roads',    label: 'Roads',     color: 'bg-slate-500',   enabled: true  },
]

export function MapPreview() {
  const [active, setActive] = useState(() =>
    Object.fromEntries(LAYERS.map((l) => [l.id, l.enabled]))
  )

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <MapIcon className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">GIS Map Preview</h3>
            <p className="text-[10px] text-slate-400">Mappls integration · Coming soon</p>
          </div>
        </div>
        <Link
          to="/public/colonies?has_map=true"
          className="text-[11px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
        >
          <Maximize2 className="w-3 h-3" />
          Expand
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px]">
        {/* Map canvas */}
        <div className="relative h-64 lg:h-72 bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50 overflow-hidden">
          {/* Grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="mapgrid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#cbd5e1" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mapgrid)" />
          </svg>

          {/* Mock markers */}
          {[
            { top: '20%', left: '25%', color: 'bg-blue-500',    label: 'BDA' },
            { top: '35%', left: '55%', color: 'bg-emerald-500', label: 'Pvt' },
            { top: '55%', left: '35%', color: 'bg-amber-500',   label: 'Suo' },
            { top: '65%', left: '65%', color: 'bg-blue-500',    label: 'BDA' },
            { top: '45%', left: '75%', color: 'bg-orange-500',  label: 'Pen' },
          ].map((m, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 200 }}
              className="absolute"
              style={{ top: m.top, left: m.left }}
            >
              <div className={`relative ${m.color} w-6 h-6 rounded-full flex items-center justify-center
                              ring-4 ring-white shadow-md`}>
                <MapPin className="w-3 h-3 text-white" />
                <div className={`absolute -inset-1 ${m.color} rounded-full opacity-30 animate-ping`} />
              </div>
            </motion.div>
          ))}

          {/* Empty-state overlay */}
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto
                          bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2
                          flex items-center gap-2 text-xs text-slate-600 max-w-xs">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            Live map data will appear here once Mappls is connected.
          </div>
        </div>

        {/* Layer toggles */}
        <div className="border-t lg:border-t-0 lg:border-l border-slate-100 p-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Layers
          </div>
          <div className="space-y-1.5">
            {LAYERS.map((l) => (
              <label
                key={l.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md
                           hover:bg-slate-50 cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={active[l.id]}
                  onChange={(e) => setActive((p) => ({ ...p, [l.id]: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                />
                <span className={`w-2 h-2 rounded-full ${l.color}`} />
                <span className="text-xs text-slate-600">{l.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
