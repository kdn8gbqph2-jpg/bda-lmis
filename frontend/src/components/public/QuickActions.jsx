/**
 * QuickActions — compact horizontally-scrolling action chips.
 *
 * Provides shortcuts to common public-facing tasks.  External actions
 * (auction, notices, land bank) are placeholders for now — they render
 * but display a tooltip on hover.
 */

import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Map, Gavel, Bell, FileDown, Landmark, ArrowRight,
} from 'lucide-react'

const ACTIONS = [
  {
    label:    'GIS Map',
    sub:      'Explore colonies',
    icon:     Map,
    to:       '/public/colonies?has_map=true',
    color:    'text-blue-700',
    bg:       'bg-blue-50',
    hover:    'hover:border-blue-300',
    disabled: false,
  },
  {
    label:    'Auction Plots',
    sub:      'Upcoming auctions',
    icon:     Gavel,
    to:       null,
    color:    'text-amber-700',
    bg:       'bg-amber-50',
    hover:    'hover:border-amber-300',
    disabled: true,
  },
  {
    label:    'Public Notices',
    sub:      'Latest announcements',
    icon:     Bell,
    to:       null,
    color:    'text-emerald-700',
    bg:       'bg-emerald-50',
    hover:    'hover:border-emerald-300',
    disabled: true,
  },
  {
    label:    'Download Layouts',
    sub:      'Maps & plans',
    icon:     FileDown,
    to:       '/public/colonies?has_map=true',
    color:    'text-indigo-700',
    bg:       'bg-indigo-50',
    hover:    'hover:border-indigo-300',
    disabled: false,
  },
  {
    label:    'Land Bank',
    sub:      'Available parcels',
    icon:     Landmark,
    to:       null,
    color:    'text-rose-700',
    bg:       'bg-rose-50',
    hover:    'hover:border-rose-300',
    disabled: true,
  },
]

function ActionCard({ action, delay }) {
  const Icon  = action.icon
  const cls   = `group relative flex items-center gap-2.5 px-3 py-2.5 bg-white
                 border border-slate-200 rounded-lg transition-all
                 ${action.disabled ? 'opacity-60 cursor-not-allowed' : `${action.hover} hover:shadow-sm`}`
  const inner = (
    <>
      <div className={`w-8 h-8 rounded-lg ${action.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${action.color}`} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-700 truncate">{action.label}</div>
        <div className="text-[10px] text-slate-400 truncate">{action.sub}</div>
      </div>
      {!action.disabled && (
        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition flex-shrink-0" />
      )}
      {action.disabled && (
        <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
          Soon
        </span>
      )}
    </>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      {action.disabled
        ? <div className={cls} title="Coming soon">{inner}</div>
        : <Link to={action.to} className={cls}>{inner}</Link>}
    </motion.div>
  )
}

export function QuickActions() {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Quick Actions
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {ACTIONS.map((a, i) => (
          <ActionCard key={a.label} action={a} delay={i * 0.04} />
        ))}
      </div>
    </section>
  )
}
