/**
 * PublicDashboardPage — public portal landing page.
 *
 * Two sections only: a welcoming hero with the total-colony count and
 * primary CTAs, and a compact 5-tile category grid for browsing.
 *
 * Search lives in the TopNavbar (always visible); the sidebar exposes
 * the same categories — so this page intentionally avoids duplicating
 * those navigation surfaces and instead acts as the landing entry point.
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPinned } from 'lucide-react'

import { publicApi } from '@/api/endpoints'
import { CATEGORIES } from '@/components/public/categories'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PublicDashboardPage() {

  const { data: counts, isLoading } = useQuery({
    queryKey: ['public-colony-counts'],
    queryFn: async () => {
      const out = {}
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          const r = await publicApi.colonyList({ colony_type: cat.value, page_size: 1 })
          out[cat.value] = r.count ?? 0
        }),
      )
      out._total = Object.values(out).reduce((a, b) => a + b, 0)
      return out
    },
    staleTime: 5 * 60 * 1000,
  })

  const total = counts?._total

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="text-center mb-14 sm:mb-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 mb-3">
          Bharatpur Development Authority
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight mb-4">
          Land &amp; Schemes Information Portal
        </h1>
        <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          {isLoading
            ? 'Browse registered colonies — layouts, khasras and plot information are publicly available.'
            : `Browse ${total ?? 0} registered colonies — layouts, khasras and plot information are publicly available.`}
        </p>

        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link
            to="/public/colonies"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white
                       text-sm font-medium rounded-lg shadow-sm hover:bg-blue-800 transition"
          >
            Browse all colonies
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/public/colonies?has_map=true"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700
                       bg-white border border-slate-300 rounded-lg hover:border-slate-400
                       hover:bg-slate-50 transition"
          >
            <MapPinned className="w-4 h-4 text-slate-500" />
            Colonies with maps
          </Link>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
          Browse by category
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CATEGORIES.map((cat) => {
            const Icon  = cat.icon
            const count = counts?.[cat.value]
            return (
              <Link
                key={cat.value}
                to={`/public/colonies?colony_type=${cat.value}`}
                className={`group block bg-white rounded-xl border ${cat.border}
                            p-5 shadow-sm transition hover:shadow-md`}
              >
                <div className={`w-10 h-10 ${cat.tint} rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${cat.text}`} strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm leading-snug mb-2">
                  {cat.label}
                </h3>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {count ?? '—'}
                </p>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
