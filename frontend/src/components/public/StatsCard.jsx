/**
 * StatsCard — compact horizontal KPI card.
 *
 * Props:
 *   icon         lucide-react icon component
 *   label        short text under the value
 *   value        the metric (number or string)
 *   color        one of 'blue' | 'emerald' | 'amber' | 'red' | 'slate'
 *   loading      bool — show a skeleton bar in place of the value
 *   delay        animation delay (seconds) for staggered entry
 */

import { motion } from 'framer-motion'

const COLORS = {
  blue:    { ring: 'ring-blue-100',    bg: 'bg-blue-50',    text: 'text-blue-700'    },
  emerald: { ring: 'ring-emerald-100', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  amber:   { ring: 'ring-amber-100',   bg: 'bg-amber-50',   text: 'text-amber-700'   },
  red:     { ring: 'ring-red-100',     bg: 'bg-red-50',     text: 'text-red-700'     },
  orange:  { ring: 'ring-orange-100',  bg: 'bg-orange-50',  text: 'text-orange-700'  },
  slate:   { ring: 'ring-slate-200',   bg: 'bg-slate-100',  text: 'text-slate-700'   },
}

export function StatsCard({ icon: Icon, label, value, color = 'slate', loading = false, delay = 0 }) {
  const c = COLORS[color] ?? COLORS.slate

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-white rounded-xl border border-slate-200 px-4 py-3
                 flex items-center gap-3 hover:shadow-sm transition-shadow"
    >
      <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
        {Icon && <Icon className={`w-4.5 h-4.5 ${c.text}`} strokeWidth={2} style={{ width: 18, height: 18 }} />}
      </div>
      <div className="min-w-0 flex-1">
        {loading ? (
          <div className="h-5 w-12 bg-slate-200 rounded animate-pulse" />
        ) : (
          <div className="text-lg font-bold text-slate-800 tabular-nums leading-tight">
            {value ?? '—'}
          </div>
        )}
        <div className="text-[11px] text-slate-500 leading-tight mt-0.5 truncate">{label}</div>
      </div>
    </motion.div>
  )
}
