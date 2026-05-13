/**
 * PublicColoniesPage — institutional list view for the public portal.
 *
 * Visual language matches the redesigned PublicDashboardPage:
 *   · Light gradient header band with a faint coordinate-grid texture.
 *   · Rounded filter card with the same muted-icon-chip search input.
 *   · Colony rows with a left accent rail tinted to the colony_type,
 *     soft hover lift, animated staggered entry.
 *
 * URL query params drive the filters so dashboard links land here
 * pre-filtered (e.g. /public/colonies?colony_type=rejected_layout).
 */

import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Search, ChevronLeft, ChevronRight,
  MapPin, Calendar, FileText, Download, X,
} from 'lucide-react'
import { publicApi } from '@/api/endpoints'
import { useCountUp } from '@/hooks/useCountUp'
import { Backdrop } from '@/components/ui/Backdrop'

// ── Constants ────────────────────────────────────────────────────────────────

const COLONY_TYPE_LABELS = {
  bda_scheme:       'BDA Scheme',
  private_approved: 'Private Approved',
  suo_moto:         'Regularized Colony',
  pending_layout:   'Pending Layout',
  rejected_layout:  'Rejected Layout',
}

// Two-tier styling per type — the soft `badge` for the pill on each
// row + the colored `rail` for the accent stripe on the card's left edge.
const TYPE_STYLE = {
  bda_scheme:       { badge: 'bg-blue-50 text-blue-800 border-blue-100',         rail: 'bg-blue-500',    sub: 'बीडीए योजनाएँ'             },
  private_approved: { badge: 'bg-emerald-50 text-emerald-800 border-emerald-100', rail: 'bg-emerald-500', sub: 'निजी अनुमोदित कॉलोनियाँ'   },
  suo_moto:         { badge: 'bg-amber-50 text-amber-800 border-amber-100',       rail: 'bg-amber-500',   sub: 'नियमित कॉलोनियाँ'         },
  pending_layout:   { badge: 'bg-orange-50 text-orange-800 border-orange-100',    rail: 'bg-orange-500',  sub: 'लंबित कॉलोनी लेआउट'       },
  rejected_layout:  { badge: 'bg-red-50 text-red-800 border-red-100',             rail: 'bg-red-500',     sub: 'अस्वीकृत कॉलोनी लेआउट'    },
}

const ZONES = ['East', 'West']
const PAGE_SIZE = 20

// Motion: same restrained presets as the dashboard.
const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
}
const staggerParent = {
  initial: {}, animate: { transition: { staggerChildren: 0.04 } },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PublicColoniesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [search,     setSearch]     = useState(searchParams.get('search') ?? '')
  const [colonyType, setColonyType] = useState(searchParams.get('colony_type') ?? '')
  const [zone,       setZone]       = useState(searchParams.get('zone') ?? '')
  const [page,       setPage]       = useState(1)

  // Keep URL in sync with filters
  useEffect(() => {
    const p = {}
    if (search)     p.search      = search
    if (colonyType) p.colony_type = colonyType
    if (zone)       p.zone        = zone
    setSearchParams(p, { replace: true })
    setPage(1)
  }, [search, colonyType, zone])   // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-colonies', search, colonyType, zone, page],
    queryFn:  () => publicApi.colonyList({
      search:      search || undefined,
      colony_type: colonyType || undefined,
      zone:        zone || undefined,
      page,
      page_size:   PAGE_SIZE,
    }),
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000,
  })

  const colonies   = data?.results ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const animCount  = useCountUp(totalCount)

  const pageTitle = colonyType
    ? COLONY_TYPE_LABELS[colonyType] ?? 'Colonies'
    : 'All Colonies'

  const subLabel = colonyType ? TYPE_STYLE[colonyType]?.sub : null

  const hasFilters = !!(search || colonyType || zone)

  return (
    <div className="bg-slate-50">

      {/* ── Header band — shared portal Backdrop ── */}
      <section className="relative overflow-hidden border-b border-slate-200">
        <Backdrop />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
          {/* Breadcrumb */}
          <nav className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
            <Link to="/public" className="hover:text-blue-700 transition">Public Portal</Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <Link to="/public" className="hover:text-blue-700 transition">Dashboard</Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-700 font-medium">{pageTitle}</span>
          </nav>

          <div className="flex items-end justify-between gap-4 flex-wrap">
            <motion.div {...fadeUp} className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
                {pageTitle}
              </h1>
              {subLabel && (
                <p className="text-sm text-slate-500 mt-0.5">{subLabel}</p>
              )}
              {!subLabel && (
                <p className="text-sm text-slate-500 mt-0.5">
                  Filterable list of all colonies registered on the portal.
                </p>
              )}
            </motion.div>

            {!isLoading && (
              <motion.div {...fadeUp} className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-[#0F172A] tabular-nums leading-none">
                  {animCount}
                </span>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  {totalCount === 1 ? 'colony' : 'colonies'}
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ── Main column ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Filter bar */}
        <motion.div
          {...fadeUp}
          className="bg-white rounded-2xl border border-slate-200
                     shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 mb-6
                     flex flex-wrap gap-3 items-center"
        >
          {/* Search input with the same muted-chip icon as the top navbar */}
          <div className="relative flex-1 min-w-[200px] group">
            <span aria-hidden
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7
                             rounded-md bg-slate-100 text-slate-500
                             inline-flex items-center justify-center
                             group-focus-within:bg-blue-50 group-focus-within:text-blue-700
                             transition-colors">
              <Search className="w-3.5 h-3.5" strokeWidth={2.25} />
            </span>
            <input
              type="text"
              placeholder="Search colony name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-3 py-2.5 text-sm
                         bg-white border border-slate-200 rounded-xl
                         placeholder:text-slate-400
                         focus:outline-none focus:ring-4 focus:ring-blue-500/10
                         focus:border-blue-400 hover:border-slate-300 transition-all duration-200"
            />
          </div>

          <FilterSelect value={colonyType} onChange={setColonyType}
                        label="All Types"
                        options={Object.entries(COLONY_TYPE_LABELS)} />

          <FilterSelect value={zone} onChange={setZone}
                        label="All Zones"
                        options={ZONES.map(z => [z, z])} />

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setColonyType(''); setZone('') }}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium
                         text-slate-500 hover:text-blue-700 border border-slate-200
                         hover:border-blue-200 rounded-xl hover:bg-blue-50/40 transition"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </motion.div>

        {/* ── Colony list ── */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-red-700">
            Failed to load colonies. Please try again later.
          </div>
        ) : colonies.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12
                          text-center text-slate-500">
            <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">No colonies found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <motion.div
            {...staggerParent}
            initial="initial" animate="animate"
            className="space-y-3"
          >
            {colonies.map((colony) => (
              <motion.div key={colony.id} variants={fadeUp}>
                <ColonyRow colony={colony} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && !isLoading && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700
                         bg-white border border-slate-200 rounded-xl
                         disabled:opacity-40 disabled:cursor-not-allowed
                         hover:border-blue-300 hover:text-blue-700 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <span className="text-sm text-slate-500 tabular-nums">
              Page <span className="font-semibold text-slate-700">{page}</span> of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700
                         bg-white border border-slate-200 rounded-xl
                         disabled:opacity-40 disabled:cursor-not-allowed
                         hover:border-blue-300 hover:text-blue-700 transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, label, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-9 py-2.5 text-sm font-medium text-slate-700
                   bg-white border border-slate-200 rounded-xl
                   hover:border-slate-300 cursor-pointer
                   focus:outline-none focus:ring-4 focus:ring-blue-500/10
                   focus:border-blue-400 transition-all duration-200"
      >
        <option value="">{label}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4
                                rotate-90 text-slate-400 pointer-events-none" />
    </div>
  )
}

function ColonyRow({ colony }) {
  const style = TYPE_STYLE[colony.colony_type] ?? { badge: 'bg-slate-50 text-slate-700 border-slate-200', rail: 'bg-slate-400' }
  return (
    <Link
      to={`/public/colonies/${colony.id}`}
      className="relative block bg-white rounded-2xl border border-slate-200 p-5 pl-6
                 shadow-[0_1px_2px_rgba(15,23,42,0.04)]
                 transition-all duration-200 group overflow-hidden
                 hover:border-slate-300 hover:shadow-[0_4px_16px_-6px_rgba(15,23,42,0.10)]
                 hover:-translate-y-0.5"
    >
      {/* Left accent rail in the category color */}
      <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${style.rail}`} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="font-semibold text-slate-900 group-hover:text-blue-800 transition truncate">
              {colony.name}
            </h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${style.badge}`}>
              {colony.colony_type_label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
            {colony.zone && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {colony.zone} Zone
              </span>
            )}
            {colony.layout_approval_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Approved: {colony.layout_approval_date}
              </span>
            )}
            {colony.total_plots > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> {colony.total_plots} plots
              </span>
            )}
          </div>
        </div>

        {colony.has_map && (
          <div className="flex-shrink-0 hidden sm:inline-flex items-center gap-1
                          text-xs font-medium text-blue-700
                          bg-blue-50 border border-blue-100 px-2.5 py-1.5 rounded-lg">
            <Download className="w-3.5 h-3.5" />
            Map available
          </div>
        )}
      </div>
    </Link>
  )
}
