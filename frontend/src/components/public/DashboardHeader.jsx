/**
 * DashboardHeader — compact dashboard greeting band.
 *
 * Replaces the oversized hero with a tight title block and the location chip.
 * No stats inside — those live in the StatsRow below for better hierarchy.
 */

import { MapPin } from 'lucide-react'
import { motion } from 'framer-motion'

export function DashboardHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start justify-between gap-4 mb-5 flex-wrap"
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">
          Colony Information Dashboard
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Bharatpur Development Authority — Public Land Management Records
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          भरतपुर विकास प्राधिकरण — सार्वजनिक भूमि प्रबंधन अभिलेख
        </p>
      </div>

      {/* Location chip */}
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      bg-blue-50 border border-blue-100 text-xs font-medium text-blue-700">
        <MapPin className="w-3.5 h-3.5" />
        Bharatpur, Rajasthan
      </div>
    </motion.div>
  )
}
