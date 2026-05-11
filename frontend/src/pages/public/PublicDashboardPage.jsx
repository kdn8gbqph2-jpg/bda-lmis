/**
 * PublicDashboardPage — public colony portal landing page.
 *
 * Composition:
 *   DashboardHeader   — compact greeting + location
 *   StatsRow          — 6 horizontal KPI cards
 *   QuickActions      — 5 shortcut chips
 *   CategoryGrid      — 5 colony-type cards (main focus)
 *   MapPreview        — GIS placeholder for future Mappls integration
 *   AnalyticsSection  — distribution donut + approval status bars
 *   Info banner       — public-portal disclaimer
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Building2, CheckCircle2, AlertCircle, Clock, XCircle, Layers, Info,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { publicApi } from '@/api/endpoints'
import { CATEGORIES } from '@/components/public/categories'

import { DashboardHeader }   from '@/components/public/DashboardHeader'
import { StatsCard }         from '@/components/public/StatsCard'
import { CategoryCard }      from '@/components/public/CategoryCard'
import { QuickActions }      from '@/components/public/QuickActions'
import { MapPreview }        from '@/components/public/MapPreview'
import { AnalyticsSection }  from '@/components/public/AnalyticsSection'

// ── Stats-row config ──────────────────────────────────────────────────────────
// Order matches the visual grid; "Total" first, then 5 category breakdowns.

const STAT_ITEMS = [
  { key: 'total',            label: 'Total Colonies',   icon: Layers,        color: 'slate'   },
  { key: 'bda_scheme',       label: 'BDA Schemes',      icon: Building2,     color: 'blue'    },
  { key: 'private_approved', label: 'Private Approved', icon: CheckCircle2,  color: 'emerald' },
  { key: 'suo_moto',         label: 'SUO-Moto',         icon: AlertCircle,   color: 'amber'   },
  { key: 'pending_layout',   label: 'Pending',          icon: Clock,         color: 'orange'  },
  { key: 'rejected_layout',  label: 'Rejected',         icon: XCircle,       color: 'red'     },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PublicDashboardPage() {

  // Fetch a count for each colony_type in parallel.
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ['public-colony-counts'],
    queryFn: async () => {
      const out = {}
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          const r = await publicApi.colonyList({ colony_type: cat.value, page_size: 1 })
          out[cat.value] = r.count ?? 0
        }),
      )
      return out
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch total separately (avoids needing a sum endpoint).
  const { data: totalData, isLoading: totalLoading } = useQuery({
    queryKey: ['public-colony-total'],
    queryFn:  () => publicApi.colonyList({ page_size: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const total   = totalData?.count ?? null
  const loading = countsLoading || totalLoading

  const statValue = (key) => {
    if (key === 'total') return total
    return counts?.[key]
  }

  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto">

      {/* Greeting */}
      <DashboardHeader />

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-6">
        {STAT_ITEMS.map((s, i) => (
          <StatsCard
            key={s.key}
            icon={s.icon}
            label={s.label}
            value={statValue(s.key)}
            color={s.color}
            loading={loading}
            delay={i * 0.04}
          />
        ))}
      </section>

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <QuickActions />

      {/* ── Category cards (primary focus) ─────────────────────────────────── */}
      <section className="mb-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-700">Colony Categories</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Browse colonies by classification
            </p>
          </div>
          <Link
            to="/public/colonies"
            className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {CATEGORIES.map((cat, i) => (
            <CategoryCard
              key={cat.value}
              cat={cat}
              count={counts?.[cat.value]}
              loading={countsLoading}
              delay={i * 0.05}
            />
          ))}
        </div>
      </section>

      {/* ── Map preview ───────────────────────────────────────────────────── */}
      <section className="mb-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-700">Geographic Overview</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualize colonies across Bharatpur
            </p>
          </div>
        </div>
        <MapPreview />
      </section>

      {/* ── Analytics ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-700">Analytics</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Colony classification breakdown
            </p>
          </div>
        </div>
        <AnalyticsSection counts={counts} loading={countsLoading} />
      </section>

      {/* ── Disclaimer ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800"
      >
        <Info className="w-5 h-5 flex-shrink-0 text-blue-500 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold">Public Information Portal — </span>
          Colony layout maps are available for download where uploaded.
          For official patta records, plot allocations, or document enquiries,
          please visit the BDA office or use the{' '}
          <Link to="/login" className="underline hover:text-blue-900">Staff Portal</Link>.
        </div>
      </motion.div>

      {/* Bottom padding so the disclaimer doesn't hug the scroll edge */}
      <div className="h-6" />
    </div>
  )
}
