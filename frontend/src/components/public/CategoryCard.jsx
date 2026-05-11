/**
 * CategoryCard — colony-type category card with top accent, icon, counts, CTA.
 *
 * Props:
 *   cat       category config object (label, labelHi, description, icon, color)
 *   count     numeric colony count for this category
 *   loading   bool — show skeleton while count is fetching
 *   delay     animation delay (seconds)
 */

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export function CategoryCard({ cat, count, loading = false, delay = 0 }) {
  const Icon = cat.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -2 }}
    >
      <Link
        to={`/public/colonies?colony_type=${cat.value}`}
        className={`group relative flex flex-col bg-white border ${cat.border}
                    rounded-xl overflow-hidden hover:shadow-md transition-shadow h-full`}
      >
        {/* Top accent */}
        <div className={`h-1 w-full ${cat.accent}`} />

        <div className="p-4 flex-1 flex flex-col">
          {/* Icon + count row */}
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-lg ${cat.tint} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${cat.text}`} strokeWidth={2} />
            </div>

            <div className={`text-xs font-semibold px-2 py-0.5 rounded-md ${cat.badge} tabular-nums`}>
              {loading
                ? <span className="inline-block w-5 h-3 bg-current opacity-30 rounded animate-pulse" />
                : `${count ?? 0}`
              }
            </div>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-slate-800 text-sm leading-snug
                         group-hover:text-blue-700 transition-colors">
            {cat.label}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{cat.labelHi}</p>

          {/* Description */}
          <p className="text-xs text-slate-500 leading-relaxed mt-2 line-clamp-2 flex-1">
            {cat.description}
          </p>

          {/* CTA */}
          <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${cat.text}
                           group-hover:gap-2 transition-all`}>
            View Colonies
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
